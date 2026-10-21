$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

$targets = @()
$targets += Get-ChildItem "$root\client\src" -Recurse -Include *.js,*.jsx -File
$targets += Get-Item "$root\client\tailwind.config.js"
foreach ($d in 'routes','services','migrations','util','utils','middlewares','templates') {
    $p = "$root\server\$d"
    if (Test-Path $p) { $targets += Get-ChildItem $p -Recurse -Include *.js -File }
}
$targets += Get-Item "$root\server\index.js"

$skip = 'backup-azul|_backup\.js|PropostaComercialSuperAdmin|\\routes\\protheus\.js$'
$rules = @(
    @('METALFISA INDÚSTRIA METALÚRGICA LTDA', 'LYNX EMS'),
    @('METALFISA INDUSTRIAL LTDA', 'LYNX EMS'),
    @('(?i:MetalFisa) Industrial Ltda', 'Lynx EMS'),
    @('METALFISA INDUSTRIAL', 'LYNX EMS'),
    @('MetalFisa Indústria Metalúrgica', 'Lynx EMS'),
    @('MetalFisa Antigravity ERP', 'Lynx EMS ERP'),
    @('MetalFisa / Lynx \(Matriz\)', 'Lynx EMS (Matriz)'),
    @('MetalFisa / Lynx', 'Lynx EMS'),
    @('(?<![\w.@/])METALFISA(?!\w)', 'LYNX EMS'),
    @('(?<![\w.@/])(MetalFisa|Metalfisa)(?!\w)', 'Lynx EMS')
)

$changed = 0
foreach ($f in $targets) {
    if ($f.FullName -match $skip) { continue }
    $text = [IO.File]::ReadAllText($f.FullName)
    $new = $text
    foreach ($r in $rules) { $new = [regex]::Replace($new, $r[0], $r[1]) }
    if ($new -ne $text) {
        [IO.File]::WriteAllText($f.FullName, $new, $utf8)
        $changed++
        Write-Output "changed: $($f.FullName.Replace($root, ''))"
    }
}
Write-Output "TOTAL arquivos alterados: $changed"
