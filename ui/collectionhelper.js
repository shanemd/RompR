var collectionHelper = function() {

    var monitortimer = null;
    var monitorduration = 1000;
    var update_load_timer = null;
    var update_load_timer_running = false;
    var returned_data = new Array();
    var update_timer = null;
    var notify = false;

    function scanFiles(cmd) {
        collectionHelper.prepareForLiftOff(language.gettext("label_updating"));
        collectionHelper.markWaitFileList(language.gettext("label_updating"));
        uiHelper.emptySearchResults();
        debug.log("PLAYER","Scanning Files",cmd,prefs.player_backend);
        debug.shout("PLAYER","Scanning using",cmd);
        player.controller.do_command_list([[cmd]], function() {
            update_load_timer = setTimeout( pollAlbumList, 2000);
            update_load_timer_running = true;
            player.controller.checkProgress();
        });
    }

    function pollAlbumList() {
        if(update_load_timer_running) {
            clearTimeout(update_load_timer);
            update_load_timer_running = false;
        }
        $.getJSON("player/mpd/postcommand.php", checkPoll);
    }

    function checkPoll(data) {
        if (data.updating_db) {
            update_load_timer = setTimeout( pollAlbumList, 1000);
            update_load_timer_running = true;
        } else {
            loadCollection(true);
            loadFileBrowser();
        }
    }

    function loadCollection(rescan) {
        if (!prefs.hide_albumlist) {
            var albums = 'albums.php?';
            if (rescan) {
                albums += 'rebuild=yes&dump='+collectionHelper.collectionKey('a');
            } else {
                albums += 'item='+collectionHelper.collectionKey('a');
            }
            debug.log("GENERAL","Loading Collection from URL",albums);
            $.ajax({
                type: "GET",
                url: albums,
                timeout: prefs.collection_load_timeout,
                dataType: "html",
                success: function(data) {
                    clearTimeout(monitortimer);
                    $("#collection").html(data);
                    player.collectionLoaded = true;
                    player.updatingcollection = false;
                    if ($('#emptycollection').length > 0) {
                        player.collection_is_empty = true;
                        $('#collectionbuttons').show();
                        prefs.save({ collectioncontrolsvisible: true });
                        $('[name="donkeykong"]').makeFlasher({flashtime: 0.5, repeats: 3});
                    } else {
                        player.collection_is_empty = false;
                    }
                    data = null;
                    if (albums.match(/rebuild/)) {
                        infobar.notify(language.gettext('label_updatedone'));
                        collectionHelper.scootTheAlbums($("#collection"));
                    }
                    layoutProcessor.postAlbumActions($('#collection'));
                    if (notify !== false) {
                        infobar.removenotify(notify);
                        notify = false;
                    }
                    loadAudiobooks();
                },
                error: function(data) {
                    clearTimeout(monitortimer);
                    collectionHelper.disableCollectionUpdates();
                    var html = '<p align="center"><b><font color="red">Failed To Generate Collection</font></b></p>';
                    if (data.responseText) {
                        html += '<p align="center">'+data.responseText+'</p>';
                    }
                    if (data.statusText) {
                        html += '<p align="center">'+data.statusText+'</p>';
                    }
                    html += '<p align="center"><a href="https://fatg3erman.github.io/RompR/Troubleshooting#very-large-collections" target="_blank">Read The Troubleshooting Docs</a></p>';
                    $("#collection").html(html);
                    debug.error("PLAYER","Failed to generate collection",data);
                    infobar.error('error_collectionupdate');
                    if (notify !== false) {
                        infobar.removenotify(notify);
                        notify = false;
                    }
                    player.updatingcollection = false;
                }
            });
            monitortimer = setTimeout(checkUpdateMonitor,monitorduration);
        } else {
            loadAudiobooks();
        }
    }

    function loadAudiobooks() {
        if (prefs.hide_audiobooklist) {
            return false;
        }
        $('#audiobooks').load('albums.php?item='+collectionHelper.collectionKey('z'));
    }

    function loadFileBrowser() {
        if (prefs.hide_filelist) {
            return false;
        }
        var files = 'dirbrowser.php';
        debug.log("GENERAL","Loading File Browser from URL",files);
        $("#filecollection").load(files);
    }

    function checkUpdateMonitor() {
        $.ajax({
            type: "GET",
            url: 'utils/checkupdateprogress.php',
            dataType: 'json',
            success: function(data) {
                debug.debug("UPDATE",data);
                $('#updatemonitor').html(data.current);
                if (player.updatingcollection) {
                    monitortimer = setTimeout(checkUpdateMonitor,monitorduration);
                }
            },
            error: function(data) {
                debug.log("UPDATE","ERROR",data);
                if (player.updatingcollection) {
                    monitortimer = setTimeout(checkUpdateMonitor,monitorduration);
                }
            }
        });
    }

    function updateUIElements() {

        if (dbQueue.queuelength() > 0) {
            debug.log("UI","Deferring updates due to outstanding requests");
            clearTimeout(update_timer);
            setTimeout(updateUIElements, 1000);
            return;
        }

        returned_data.forEach(function(rdata, index) {

            if (rdata && rdata.hasOwnProperty('deletedalbums')) {
                $.each(rdata.deletedalbums, function(i, v) {
                    debug.log("REMOVING", "Album", v);
                    uiHelper.removeAlbum('aalbum'+v);
                });
            }

            if (rdata && rdata.hasOwnProperty('deletedartists')) {
                $.each(rdata.deletedartists, function(i, v) {
                    debug.log("REMOVING", "Artist", v);
                    uiHelper.removeArtist(v);
                });
            }

            if (rdata && rdata.hasOwnProperty('modifiedalbums')) {
                $('#emptycollection').remove();
                $.each(rdata.modifiedalbums, function(i,v) {
                    // We remove and replace any modified albums, as they may have a new date or albumartist which would cause
                    // them to appear elsewhere in the collection. First remove the dropdown if it exists and replace its contents
                    debug.log("MODIFIED","Album",v.id);
                    uiHelper.insertAlbum(v);
                });
            }

            if (rdata && rdata.hasOwnProperty('modifiedartists')) {
                $('#emptycollection').remove();
                $.each(rdata.modifiedartists, function(i,v) {
                    // The only thing to do with artists is to add them in if they don't exist
                    // NOTE. Do this AFTER inserting new albums, because if we're doing albumbyartist with banners showing
                    // then the insertAfter logic will be wrong if we've already inserted the artist banner. We also need
                    // to remove and replace the banner when that sort option is used, because we only insertAfter an album ID
                    if (prefs.sortcollectionby == 'albumbyartist') {
                        $("#aartist"+v.id).remove();
                    }
                    var x = uiHelper.findArtistDisplayer('aartist'+v.id);
                    if (x.length == 0) {
                        uiHelper.insertArtist(v);
                    }
                });
            }

            if (rdata && rdata.hasOwnProperty('addedtracks') && rdata.addedtracks.length > 0) {
                $.each(rdata.addedtracks, function(i, v) {
                    if (v.albumindex !== null && v.trackuri != '') {
                        // (Ignore if it went into the wishlist)
                        debug.log("INSERTED","Displaying",v);
                        layoutProcessor.displayCollectionInsert(v);
                    }
                });
            } else {
                infobar.markCurrentTrack();
            }

            if (rdata && rdata.hasOwnProperty('stats')) {
                // stats is another html fragment which is the contents of the
                // statistics box at the top of the collection
                $("#fothergill").html(rdata.stats);
            }

            returned_data[index] = null;

        });

        collectionHelper.scootTheAlbums($("#collection"));

    }

    return {

        rejigDoodahs: function(panel, visible) {
            if (visible) {
                switch (panel) {
                    case 'albumlist':
                        loadCollection(false);
                        break;

                    case 'filelist':
                        loadFileBrowser();
                        break;

                    case 'audiobooklist':
                        loadAudiobooks();
                        break;
                }
            }
        },

        disableCollectionUpdates: function() {
            $('button[name="donkeykong"]').off('click').css('opacity', '0.2');
            $('button[name="dinkeyking"]').off('click').css('opacity', '0.2');
        },

        enableCollectionUpdates: function() {
            $('button[name="donkeykong"]').off('click').on('click', function() { collectionHelper.checkCollection(true, false) }).css('opacity', '');
            $('button[name="dinkeyking"]').off('click').on('click', function() { collectionHelper.checkCollection(true, false) }).css('opacity', '');
        },

        forceCollectionReload: function() {
            debug.log("COLLECTION", "Forcing Collection reload");
            collection_status = 0;
            collectionHelper.checkCollection(false, false);
        },

        prepareForLiftOff: function(text) {
            notify = infobar.permnotify(text);
            $("#collection").empty();
            doSomethingUseful('collection', text);
            var x = $('<div>',{ id: 'updatemonitor', class: 'tiny', style: 'padding-left:1em;margin-right:1em'}).insertAfter($('#spinner_collection'));
        },

        markWaitFileList: function(text) {
            $("#filecollection").empty();
            doSomethingUseful("filecollection", text);
        },

        collectionKey: function(w) {
            return w+prefs.sortcollectionby+'root';
        },

        checkCollection: function(forceup, rescan) {
            debug.log("COLLECTION", "checking collection. collection_status is",collection_status);
            if (forceup && player.updatingcollection) {
                infobar.error(language.gettext('error_nocol'));
                return;
            }
            var update = forceup;
            if (prefs.updateeverytime && prefs.player_backend == collection_type) {
                debug.mark("COLLECTION","Updating Collection due to preference");
                update = true;
            } else {
                if (!prefs.hide_albumlist && collection_status == 1 && prefs.player_backend == collection_type) {
                    debug.mark("COLLECTION","Updating Collection because it is out of date");
                    collection_status = 0;
                    update = true;
                }
            }
            if (update) {
                player.updatingcollection = true;
                $("#searchresultholder").html('');
                scanFiles(rescan ? 'rescan' : 'update');
            } else {
                loadCollection(false);
                loadFileBrowser();
            }
        },

        scootTheAlbums: function(jq) {
            if (prefs.downloadart) {
                debug.log("COLLECTION", "Scooting albums in",jq.attr('id'));
                $.each(jq.find("img.notexist"), function() {
                    coverscraper.GetNewAlbumArt($(this));
                });
            }
        },

        updateCollectionDisplay: function(rdata) {
            // rdata contains HTML fragments to insert into the collection
            // Otherwise we would have to reload the entire collection panel every time,
            // which would cause any opened dropdowns to be mysteriously closed,
            // which would just look shit.
            debug.trace("COLLECTION","Update Display",rdata);
            if (rdata) {
                returned_data.push(rdata);
                clearTimeout(update_timer);
                setTimeout(updateUIElements, 1000);
            }
        }

    }

}();
