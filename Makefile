ZIP     = zip
OPTION  = -6
# IGNORE  = -x .DS_Store
PACKAGE = context-search.xpi
FILE    = \
  ./content/ContextSearch.jsm \
  chrome.manifest \
  bootstrap.js \
  install.rdf


all: clean xpi

xpi: $(FILES)
	$(ZIP) $(OPTION) $(PACKAGE) $(FILE)

clean:
	-rm -rf $(PACKAGE)
