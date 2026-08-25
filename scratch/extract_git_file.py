import subprocess
import codecs

# Get the file content of frmDadosPecaCorrente.vb from the last commit
cmd = ["git", "show", "HEAD:SINCO-SolidEdeg 1.0/frmDadosPecaCorrente.vb"]
res = subprocess.run(cmd, cwd=r"c:\Users\lynx\Documents\MetalFisa Anty\Metalfisa - SINCO-SolidEdeg 1.0", stdout=subprocess.PIPE, stderr=subprocess.PIPE)

content = res.stdout.decode('utf-8', errors='ignore')

# Write to a file
with codecs.open(r"c:\Users\lynx\Documents\MetalFisa Anty\scratch\git_extracted.txt", "w", encoding="utf-8") as out:
    # Find btnDxf_Click
    pos_dxf = content.find("Private Sub btnDxf_Click")
    if pos_dxf != -1:
        out.write("=== btnDxf_Click ===\n")
        out.write(content[pos_dxf:pos_dxf+3500])
        out.write("\n=====================\n\n")
        
    pos_pdf = content.find("Private Sub btnGerarPdf_Click")
    if pos_pdf != -1:
        out.write("=== btnGerarPdf_Click ===\n")
        out.write(content[pos_pdf:pos_pdf+3500])
        out.write("\n=====================\n\n")

print("SUCCESS: Git extracted code written to scratch/git_extracted.txt")
