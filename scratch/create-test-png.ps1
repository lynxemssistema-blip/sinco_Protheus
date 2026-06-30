Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(600, 440)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$font  = New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)
$font2 = New-Object System.Drawing.Font("Arial", 18)
$black = [System.Drawing.Brushes]::Black
$g.DrawString("METALFISA", $font, $black, 20, 30)
$g.DrawString("BRIDGE v5 - GDI PRINT", $font2, $black, 20, 100)
$g.DrawString("PSI Rabbit 214 BR", $font2, $black, 20, 150)
$g.DrawString("Argox PPLA driver OK", $font2, $black, 20, 200)
$bmp.Save("C:\Users\lynx\AppData\Local\Temp\label_test.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host "PNG criado OK"
