
import sys

file_path = r'c:\Users\adm\Desktop\MetalFisa Anty\client\src\pages\GestaoOPsPage.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_imports = [
    "import PCPExportTab from '../components/orders/PCPExportTab';\n",
    "import DocsModal from '../components/DocsModal';\n",
    "import NotesDrawer from '../components/NotesDrawer';\n",
    "import MeetingReportModal from '../components/MeetingReportModal';\n",
    "import ProductImageModal from '../components/ProductImageModal'; // Import Image Modal\n",
    "import EngineeringControlModal from '../components/EngineeringControlModal';\n",
    "import ProductionComparison from '../components/ProductionComparison';\n",
    "import PCPForecastModal from '../components/PCPForecastModal';\n",
    "import PCPMetalDrawer from '../components/PCPMetalDrawer';\n",
    "import InvoiceDetailsModal from '../components/InvoiceDetailsModal';\n"
]

lines[8:18] = new_imports

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

