import codecs

with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'r', 'utf-8') as f:
    text = f.read()

# find: `const viewMode = orderFilters.viewMode;`
# replace with: `const viewMode = 'flat'; // Forced flat view for Gestão de OPs`
text = text.replace('const viewMode = orderFilters.viewMode;', "const viewMode = 'flat'; // Forced flat view for Gestão de OPs")

with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'w', 'utf-8') as f:
    f.write(text)

print('Forced flat viewMode')
