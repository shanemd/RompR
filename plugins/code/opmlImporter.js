var opmlImporter = function() {

	var opmlv = null;

	return {

		open: function() {

        	if (opmlv == null) {
	        	opmlv = browser.registerExtraPlugin("opmlv", language.gettext("label_opmlimporter"), opmlImporter, 'https://fatg3erman.github.io/RompR/OPML-Importer');
				$('#opmlvfoldup').append(
					'<div class="containerbox brick_wide">'+
					'<form id="opmluploader" action="plugins/code/opmluploader.php" method="post" enctype="multipart/form-data">'+
					'<input class="expand infowiki" name="opmlfile" type="file" />'+
					'<input class="fixed" id="opmlsubmit" value="Upload" type="button" />'+
					'</form>'+
					'</div>'
				);
	            $('#opmlvfoldup').append('<div id="opmllist"></div>');
				$('#opmlsubmit').bind('click', opmlImporter.uploadFile);
				opmlv.slideToggle('fast', function() {
					browser.goToPlugin("opmlv");
				});
	        } else {
	        	browser.goToPlugin("opmlv");
	        }

		},

		handleClick: function(element, event) {

		},

		close: function() {
			opmlv = null;
		},
		
		uploadFile: function() {
			var formElement = document.getElementById('opmluploader');
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "plugins/code/opmluploader.php");
            xhr.responseType = "json";
            xhr.onload = function () {
                if (xhr.status === 200) {
					opmlImporter.gotData(xhr.response);
                } else {
                    infobar.notify(infobar.ERROR, "Failed To Upload OPML FIle");
                }
            };
            xhr.send(new FormData(formElement));
		},
		
		gotData: function(data) {
			debug.log("OPML IMPORTER", "File Parsed",data);
			var html = '';
			html += '<div class="configtitle textcentre brick_wide">OPML Import</div>';
			html += '<div class="containerbox fullwidth">';
			html += '<button class="fixed" name="opml_selectall">Select All</button>';
			html += '<button class="fixed" name="opml_selectnone">Select None</button>';
			html += '<div class="expand"></div>';
			html += '<button class="fixed" name="opml_import">Import Selected</button>';
			html += '</div>';
			html += '<table width="100%">';
			for (var i in data) {
				html += '<tr>';
				html += '<td>';
				if (data[i].subscribed) {
					html += '<i class="icon-tick smallicon"></i>';
				} else {
					html += '<div class="styledinputs">';
					html += '<input type="hidden" value="'+data[i].feedURL+'" />';
					html += '<input id="opml_'+i+'" class="topcheck" type="checkbox" />';
					html += '<label for="opml_'+i+'">&nbsp;</label>';
					html += '</div>';
				}
				html += '</td>';
				html += '<td>'+data[i].Title+'</td>';
				html += '<td><a href="'+data[i].htmlURL+'" target="_blank">'+data[i].htmlURL+'</a></td>';
				html += '</tr>';
			}
			html += '</table>';
			$('#opmllist').html(html);
			$('[name="opml_selectall"]').bind('click', opmlImporter.selectAll);
			$('[name="opml_selectnone"]').bind('click', opmlImporter.selectNone);
			$('[name="opml_import"]').bind('click', opmlImporter.Import);
			opmlImporter.selectAll();
		},
		
		selectAll: function() {
			$('#opmllist input[type="checkbox"]').prop('checked', true);
		},
		
		selectNone: function() {
			$('#opmllist input[type="checkbox"]').prop('checked', false);
		},
		
		Import: function() {
			$('[name="opml_import"]').unbind('click');
			var s = $('#opmllist input[type="checkbox"]:checked');
			if (s.length > 0) {
				opmlImporter.subscribeToNext(s.first());
			} else {
				$('[name="opml_import"]').bind('click', opmlImporter.Import);
				podcasts.reloadList();
			}
		},
		
		subscribeToNext: function(c) {
			var feedUrl = c.prev().val();
			var s = $('<i>', {class: 'icon-spin6 spinner smallicon'}).insertBefore(c);
			c.next().remove();
			c.remove();
			debug.log("OPML IMPORTER","Importing Podcast",feedUrl);
			podcasts.getPodcast(feedUrl, function(flag) {
				if (flag) {
					debug.log("OPML Importer", "Success");
					s.replaceWith('<i class="icon-tick smallicon"></i>');
					opmlImporter.Import();
				} else {
					debug.warn("OPML Importer", "Failed to import",feedUrl);
					s.replaceWith('<i class="icon-attention-1 smallicon"></i>');
					opmlImporter.Import();
				}
			});
		}

	}

}();

pluginManager.setAction(language.gettext("label_opmlimporter"), opmlImporter.open);
opmlImporter.open();
