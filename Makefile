ZIP     = zip
OPTION  = -6
# IGNORE  = -x .DS_Store
PACKAGE = context-search.xpi
FILE    = \
  ./modules/ContextSearch.jsm \
  ./content/contextsearch.js \
  ./content/contextsearch.xul \
  ./defaults/preferences/contextsearch.js \
  chrome.manifest \
  bootstrap.js \
  install.rdf


all: clean xpi

xpi: $(FILES)
	$(ZIP) $(OPTION) $(PACKAGE) $(FILE)

clean:
	-rm -rf $(PACKAGE)
