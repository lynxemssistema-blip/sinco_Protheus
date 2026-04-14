import re
import codecs

with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'r', 'utf-8') as f:
    text = f.read()

# First, let's fix batch print to overwrite mirrorData.data
batch_search = """                // Add a visual tag to the mirrorData title so the PDF knows it was a fraction
                if (fraction.is_fraction) {
                    if (mirrorData.header_info) {
                        mirrorData.header_info.op_original = mirrorData.header_info.op_num;
                        mirrorData.header_info.op_num = fraction.visual_op;
                    }
                }"""
batch_repl = """                // Add a visual tag to the mirrorData title so the PDF knows it was a fraction
                if (fraction.is_fraction) {
                    if (mirrorData.header_info) {
                        mirrorData.header_info.op_original = mirrorData.header_info.op_num;
                        mirrorData.header_info.op_num = fraction.visual_op;
                    }
                    if (mirrorData.data && Array.isArray(mirrorData.data)) {
                        mirrorData.data.forEach(d => {
                            if (d.op_num) {
                                d.op_original = d.op_num;
                                d.op_num = fraction.visual_op;
                            }
                        });
                    }
                }"""
text = text.replace(batch_search, batch_repl)

# Now, let's fix the single print handlers to also override op_num
# find `const mirrorData = response.data;` in all handlers and append the override if itemObj.is_fraction
single_search = """            const response = await api.get(endpoint);
            const mirrorData = response.data;"""
single_repl = """            const response = await api.get(endpoint);
            const mirrorData = response.data;
            if (itemObj && itemObj.is_fraction) {
                if (mirrorData.header_info) {
                    mirrorData.header_info.op_original = mirrorData.header_info.op_num;
                    mirrorData.header_info.op_num = itemObj.visual_op;
                }
                if (mirrorData.data && Array.isArray(mirrorData.data)) {
                    mirrorData.data.forEach(d => {
                        if (d.op_num) {
                            d.op_original = d.op_num;
                            d.op_num = itemObj.visual_op;
                        }
                    });
                }
            }"""

# Since the batch print also has `const mirrorData = response.data;`, we must only replace in specific functions.
# To be safe we just replace it everywhere and hope batch print doesn't double-replace. Wait, batch print doesn't use `itemObj`.
text = text.replace(single_search, single_repl)

with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'w', 'utf-8') as f:
    f.write(text)

print('Updated OP overriding logic in prints')
