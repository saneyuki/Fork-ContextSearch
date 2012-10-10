ZIP     = zip
OPTION  = -6
# IGNORE  = -x .DS_Store
PACKAGE = context-search.xpi
FILE    = \
  ./content/contextsearch.js \
  ./content/contextsearch.xul \
  ./defaults/preferences/contextsearch.js \
  chrome.manifest \
  install.rdf


all:  $(PACKAGE)

$(PACKAGE):  $(FILES)
	$(ZIP) $(OPTION) $(PACKAGE) $(FILE)
