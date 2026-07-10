Add-Type -AssemblyName System.Drawing

$baseDir = $PSScriptRoot
$outRoot = Join-Path $baseDir "assets\sprites"

function Test-NameHas([string]$Name, [int[]]$CodePoints) {
    $chars = $Name.ToCharArray() | ForEach-Object { [int][char]$_ }
    foreach ($cp in $CodePoints) {
        if ($cp -notin $chars) { return $false }
    }
    return $true
}

function Open-Bitmap([string]$Path) {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $img = [System.Drawing.Image]::FromStream($ms)
    $bmp = New-Object System.Drawing.Bitmap($img)
    $img.Dispose(); $ms.Dispose()
    return $bmp
}

function Get-ImageSize([string]$Path) {
    $bmp = Open-Bitmap $Path
    $size = @{ W = $bmp.Width; H = $bmp.Height }
    $bmp.Dispose()
    return $size
}

$pngFiles = Get-ChildItem -Path $baseDir -Filter "*.png" -File |
    Where-Object {
        $s = Get-ImageSize $_.FullName
        -not ($s.W -eq 1024 -and $s.H -eq 1024)   # 구 캐릭터 시트 제외
    }

# 유니코드 코드포인트로 파일 식별 (한글 리터럴 인코딩 문제 회피)
# 정면=0xC815,0xBA74 | 달리기=0xB2EC,0xB9AC,0xAE30 | 회복=0xD68C,0xBCF5 | 장애물=0xC7A5,0xC560,0xBB34
$sheetMap = @{}
foreach ($f in $pngFiles) {
    $n = $f.Name
    if (Test-NameHas $n @(0xC815, 0xBA74)) { $sheetMap["front"] = $f.FullName }
    elseif (Test-NameHas $n @(0xB2EC, 0xB9AC)) { $sheetMap["run"] = $f.FullName }
    elseif (Test-NameHas $n @(0xD68C, 0xBCF5)) { $sheetMap["heal"] = $f.FullName }
    elseif (Test-NameHas $n @(0xC7A5, 0xBB3C)) { $sheetMap["hit"] = $f.FullName }
}

function Save-Frame($Source, $X, $Y, $W, $H, $OutPath) {
    $fmt = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    $frame = New-Object System.Drawing.Bitmap($W, $H, $fmt)
    $g = [System.Drawing.Graphics]::FromImage($frame)
    $g.Clear([System.Drawing.Color]::Transparent)
    $srcRect = New-Object System.Drawing.Rectangle($X, $Y, $W, $H)
    $g.DrawImage($Source, 0, 0, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()

    # 검정 배경을 투명으로 변환
    for ($px = 0; $px -lt $frame.Width; $px++) {
        for ($py = 0; $py -lt $frame.Height; $py++) {
            $c = $frame.GetPixel($px, $py)
            if ($c.R -lt 30 -and $c.G -lt 30 -and $c.B -lt 30) {
                $frame.SetPixel($px, $py, [System.Drawing.Color]::Transparent)
            }
        }
    }

    $dir = Split-Path $OutPath -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $frame.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $frame.Dispose()
}

function Split-FrontSheet($Path) {
    $bmp = Open-Bitmap $Path
    $fw = [math]::Floor($bmp.Width / 2)
    $fh = $bmp.Height
    @("ppiya", "oru") | ForEach-Object -Begin { $i = 0 } -Process {
        Save-Frame $bmp ($i * $fw) 0 $fw $fh (Join-Path $outRoot "$_\front.png")
        Write-Host "  -> $_/front.png"
        $i++
    }
    $bmp.Dispose()
}

function Split-GridSheet($Path, $Rows, $Cols, $SubFolder, $FrameName) {
    $bmp = Open-Bitmap $Path
    $fw = [math]::Floor($bmp.Width / $Cols)
    $fh = [math]::Floor($bmp.Height / $Rows)
    $chars = @("ppiya", "oru")
    for ($r = 0; $r -lt $Rows; $r++) {
        for ($c = 0; $c -lt $Cols; $c++) {
            $out = Join-Path $outRoot "$($chars[$r])\$SubFolder\${FrameName}_$c.png"
            Save-Frame $bmp ($c * $fw) ($r * $fh) $fw $fh $out
            Write-Host "  -> $($chars[$r])/$SubFolder/${FrameName}_$c.png"
        }
    }
    $bmp.Dispose()
}

Write-Host "매핑: front=$([bool]$sheetMap['front']) run=$([bool]$sheetMap['run']) heal=$([bool]$sheetMap['heal']) hit=$([bool]$sheetMap['hit'])"

if ($sheetMap["front"]) { Write-Host "[정면]"; Split-FrontSheet $sheetMap["front"] }
if ($sheetMap["run"])   { Write-Host "[달리기]"; Split-GridSheet $sheetMap["run"] 2 5 "run" "run" }
if ($sheetMap["heal"])  { Write-Host "[회복]"; Split-GridSheet $sheetMap["heal"] 2 4 "heal" "heal" }
if ($sheetMap["hit"])   { Write-Host "[장애물]"; Split-GridSheet $sheetMap["hit"] 2 4 "hit" "hit" }

$count = (Get-ChildItem -Path $outRoot -Recurse -Filter "*.png" -File -ErrorAction SilentlyContinue).Count
Write-Host "완료! 총 $count 개 파일 -> $outRoot"
