ZIP     = zip
OPTION  = -6
# IGNORE  = -x .DS_Store
PACKAGE = context-search.xpi
FILE    = \
  ./content/ContextSearch.js \
  ./content/WebExtRTMessageChannel.js \
  ./webextension/background.js \
  ./webextension/manifest.json \
  chrome.manifest \
  bootstrap.js \
  install.rdf

.PHONY: lint

all: clean xpi

xpi: lint $(FILES)
	$(ZIP) $(OPTION) $(PACKAGE) $(FILE)

clean:
	-rm -rf $(PACKAGE)

lint:
	npm run lint
