#Requires -Version 5.1
<#
    أداة تنظيف ويندوز - WinCleaner
    - فحص الفيروسات باستخدام Microsoft Defender (المدمج في ويندوز)
    - حذف الملفات المؤقتة والكاش لتفريغ مساحة القرص C
    - تنظيف عميق (ملفات تحديثات ويندوز القديمة + أداة تنظيف القرص)
    لا تحذف الأداة أي ملفات شخصية (المستندات، الصور، التنزيلات...).
#>

$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$Host.UI.RawUI.WindowTitle = 'WinCleaner - أداة تنظيف ويندوز'

# ---------- التشغيل كمسؤول ----------
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'يتم إعادة التشغيل بصلاحيات المسؤول...' -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

$Desktop = [Environment]::GetFolderPath('Desktop')
$LogFile = Join-Path $Desktop ("WinCleaner-log-{0}.txt" -f (Get-Date -Format 'yyyyMMdd-HHmm'))
$script:TotalFreed = [long]0

# ---------- دوال مساعدة ----------
function Write-Log {
    param([string]$Text, [string]$Color = 'Gray')
    Write-Host $Text -ForegroundColor $Color
    Add-Content -LiteralPath $LogFile -Value ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Text) -Encoding UTF8
}

function Format-Size([long]$Bytes) {
    if ($Bytes -ge 1GB) { return '{0:N2} GB' -f ($Bytes / 1GB) }
    return '{0:N1} MB' -f ($Bytes / 1MB)
}

function Get-FreeSpace {
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    return [long]$disk.FreeSpace
}

function Show-DiskInfo {
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $used = $disk.Size - $disk.FreeSpace
    $pct  = [math]::Round(($used / $disk.Size) * 100)
    Write-Log ("القرص C:  المساحة الكلية {0}  |  المستخدم {1} ({2}%)  |  الفارغ {3}" -f `
        (Format-Size $disk.Size), (Format-Size $used), $pct, (Format-Size $disk.FreeSpace)) 'Cyan'
}

function Get-FolderSize([string]$Path) {
    return [long](Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
}

# يحذف محتويات المجلد (وليس المجلد نفسه). يدعم المسارات التي تحتوي على *
function Clear-Folder {
    param([string[]]$Paths, [string]$Label)
    $freed = [long]0
    foreach ($p in $Paths) {
        $dirs = @(Get-Item -Path $p -Force -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer })
        foreach ($d in $dirs) {
            $before = Get-FolderSize $d.FullName
            Get-ChildItem -LiteralPath $d.FullName -Force -ErrorAction SilentlyContinue |
                Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
            $after = Get-FolderSize $d.FullName
            $freed += [math]::Max(0, $before - $after)
        }
    }
    $script:TotalFreed += $freed
    Write-Log ("  [OK] {0}: {1}" -f $Label, (Format-Size $freed)) 'Green'
}

# حذف ملفات محددة (مثل ملفات الـ dump)
function Remove-Files {
    param([string[]]$Paths, [string]$Label)
    $freed = [long]0
    foreach ($p in $Paths) {
        Get-Item -Path $p -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
            $size = $_.Length
            Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path -LiteralPath $_.FullName)) { $freed += $size }
        }
    }
    $script:TotalFreed += $freed
    Write-Log ("  [OK] {0}: {1}" -f $Label, (Format-Size $freed)) 'Green'
}

function Get-UserProfiles {
    $profiles = Get-CimInstance Win32_UserProfile -Filter 'Special=False' |
        Where-Object { $_.LocalPath -and (Test-Path -LiteralPath $_.LocalPath) } |
        Select-Object -ExpandProperty LocalPath
    if (-not $profiles) { $profiles = @($env:USERPROFILE) }
    return $profiles
}

function Confirm-Action([string]$Question) {
    $ans = Read-Host "$Question (y = نعم / n = لا)"
    return ($ans -match '^(y|yes|ن|نعم)$')
}

# ---------- 1) حذف الملفات المؤقتة ----------
function Invoke-TempCleanup {
    Write-Log "`n===== حذف الملفات المؤقتة والكاش =====" 'Yellow'
    Write-Log 'ملاحظة: يُفضّل إغلاق المتصفحات والبرامج المفتوحة قبل البدء.' 'DarkYellow'

    $profiles = Get-UserProfiles

    Clear-Folder -Label 'ملفات المستخدمين المؤقتة (Temp)' -Paths ($profiles | ForEach-Object { "$_\AppData\Local\Temp" })
    Clear-Folder -Label 'ملفات ويندوز المؤقتة (Windows\Temp)' -Paths "$env:SystemRoot\Temp"

    Clear-Folder -Label 'كاش Google Chrome' -Paths ($profiles | ForEach-Object {
        "$_\AppData\Local\Google\Chrome\User Data\*\Cache"
        "$_\AppData\Local\Google\Chrome\User Data\*\Code Cache"
        "$_\AppData\Local\Google\Chrome\User Data\*\GPUCache"
        "$_\AppData\Local\Google\Chrome\User Data\*\Service Worker\CacheStorage"
    })
    Clear-Folder -Label 'كاش Microsoft Edge' -Paths ($profiles | ForEach-Object {
        "$_\AppData\Local\Microsoft\Edge\User Data\*\Cache"
        "$_\AppData\Local\Microsoft\Edge\User Data\*\Code Cache"
        "$_\AppData\Local\Microsoft\Edge\User Data\*\GPUCache"
        "$_\AppData\Local\Microsoft\Edge\User Data\*\Service Worker\CacheStorage"
    })
    Clear-Folder -Label 'كاش Firefox' -Paths ($profiles | ForEach-Object {
        "$_\AppData\Local\Mozilla\Firefox\Profiles\*\cache2"
    })
    Clear-Folder -Label 'كاش متصفح ويندوز (INetCache)' -Paths ($profiles | ForEach-Object {
        "$_\AppData\Local\Microsoft\Windows\INetCache"
    })
    Clear-Folder -Label 'ملفات تقارير الأعطال (CrashDumps / WER)' -Paths (@(
        "$env:ProgramData\Microsoft\Windows\WER\ReportArchive"
        "$env:ProgramData\Microsoft\Windows\WER\ReportQueue"
        "$env:SystemRoot\Minidump"
        "$env:SystemRoot\LiveKernelReports"
    ) + ($profiles | ForEach-Object {
        "$_\AppData\Local\CrashDumps"
        "$_\AppData\Local\Microsoft\Windows\WER"
    }))
    Remove-Files -Label 'ملف تفريغ الذاكرة (MEMORY.DMP)' -Paths "$env:SystemRoot\MEMORY.DMP"

    # كاش تحديثات ويندوز (يجب إيقاف الخدمة أولاً)
    Write-Log '  ...إيقاف خدمة تحديثات ويندوز مؤقتاً' 'DarkGray'
    Stop-Service -Name wuauserv, bits -Force -ErrorAction SilentlyContinue
    Clear-Folder -Label 'ملفات تحديثات ويندوز المُنزّلة (SoftwareDistribution)' -Paths "$env:SystemRoot\SoftwareDistribution\Download"
    Start-Service -Name wuauserv, bits -ErrorAction SilentlyContinue

    # كاش تحسين التسليم (Delivery Optimization)
    $before = Get-FreeSpace
    if (Get-Command Delete-DeliveryOptimizationCache -ErrorAction SilentlyContinue) {
        Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue | Out-Null
    }
    $freed = [math]::Max(0, (Get-FreeSpace) - $before)
    $script:TotalFreed += $freed
    Write-Log ("  [OK] كاش تحسين التسليم (Delivery Optimization): {0}" -f (Format-Size $freed)) 'Green'

    # سلة المحذوفات
    $before = Get-FreeSpace
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    $freed = [math]::Max(0, (Get-FreeSpace) - $before)
    $script:TotalFreed += $freed
    Write-Log ("  [OK] سلة المحذوفات: {0}" -f (Format-Size $freed)) 'Green'
}

# ---------- 2) التنظيف العميق ----------
function Invoke-DeepCleanup {
    Write-Log "`n===== التنظيف العميق =====" 'Yellow'

    # أ) تنظيف مكونات ويندوز القديمة (WinSxS)
    Write-Log '  ...تنظيف مكونات التحديثات القديمة (DISM) - قد يستغرق عدة دقائق' 'DarkGray'
    $before = Get-FreeSpace
    & Dism.exe /Online /Cleanup-Image /StartComponentCleanup /Quiet | Out-Null
    $freed = [math]::Max(0, (Get-FreeSpace) - $before)
    $script:TotalFreed += $freed
    Write-Log ("  [OK] مكونات ويندوز القديمة (WinSxS): {0}" -f (Format-Size $freed)) 'Green'

    # ب) أداة تنظيف القرص بكل الخيارات (عدا مجلد التنزيلات)
    Write-Log '  ...تشغيل أداة تنظيف القرص (cleanmgr) - قد يستغرق عدة دقائق' 'DarkGray'
    $vc = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches'
    $excluded = @('DownloadsFolder')   # لا نحذف مجلد التنزيلات أبداً
    Get-ChildItem -Path $vc | ForEach-Object {
        if ($excluded -contains $_.PSChildName) {
            Remove-ItemProperty -Path $_.PSPath -Name 'StateFlags0777' -ErrorAction SilentlyContinue
        } else {
            New-ItemProperty -Path $_.PSPath -Name 'StateFlags0777' -Value 2 -PropertyType DWord -Force | Out-Null
        }
    }
    $before = Get-FreeSpace
    Start-Process -FilePath cleanmgr.exe -ArgumentList '/sagerun:777' -Wait -WindowStyle Hidden
    $freed = [math]::Max(0, (Get-FreeSpace) - $before)
    $script:TotalFreed += $freed
    Write-Log ("  [OK] أداة تنظيف القرص (تشمل Windows.old إن وُجد): {0}" -f (Format-Size $freed)) 'Green'

    # ج) ملف السبات hiberfil.sys
    $hib = Get-Item -Path "$env:SystemDrive\hiberfil.sys" -Force -ErrorAction SilentlyContinue
    if ($hib) {
        Write-Log ("  ملف السبات (hiberfil.sys) حجمه {0}" -f (Format-Size $hib.Length)) 'Cyan'
        if (Confirm-Action '  هل تريد تعطيل السبات (Hibernate) وحذف هذا الملف؟ (سيتوقف خيار التشغيل السريع)') {
            & powercfg.exe /hibernate off
            $script:TotalFreed += $hib.Length
            Write-Log ("  [OK] تم تعطيل السبات: {0}" -f (Format-Size $hib.Length)) 'Green'
        }
    }
}

# ---------- 3) فحص الفيروسات ----------
function Invoke-VirusScan {
    param([ValidateSet('QuickScan', 'FullScan')][string]$Type = 'QuickScan')

    Write-Log "`n===== فحص الفيروسات (Microsoft Defender) =====" 'Yellow'
    $status = Get-MpComputerStatus -ErrorAction SilentlyContinue
    if (-not $status) {
        Write-Log '  [!] برنامج Microsoft Defender غير متوفر على هذا الجهاز.' 'Red'
        return
    }
    if (-not $status.AntivirusEnabled) {
        Write-Log '  [!] Defender معطّل (غالباً بسبب وجود برنامج حماية آخر). استخدم برنامج الحماية المثبت لديك للفحص.' 'Red'
        return
    }
    if (-not $status.RealTimeProtectionEnabled) {
        Write-Log '  [!] الحماية في الوقت الحقيقي متوقفة - يُنصح بتفعيلها من "أمن Windows".' 'DarkYellow'
    }

    Write-Log '  ...تحديث تعريفات الفيروسات' 'DarkGray'
    Update-MpSignature -ErrorAction SilentlyContinue
    Write-Log ("  [OK] إصدار التعريفات: {0}" -f (Get-MpComputerStatus).AntivirusSignatureVersion) 'Green'

    if ($Type -eq 'FullScan') {
        Write-Log '  ...جاري الفحص الشامل لكل الملفات (قد يستغرق ساعة أو أكثر، لا تغلق النافذة)' 'DarkGray'
    } else {
        Write-Log '  ...جاري الفحص السريع (5-15 دقيقة تقريباً)' 'DarkGray'
    }
    $start = Get-Date
    Start-MpScan -ScanType $Type -ErrorAction SilentlyContinue

    $threats = @(Get-MpThreatDetection -ErrorAction SilentlyContinue | Where-Object { $_.InitialDetectionTime -ge $start.AddMinutes(-1) })
    if ($threats.Count -eq 0) {
        Write-Log '  [OK] انتهى الفحص - لم يتم العثور على أي تهديدات.' 'Green'
    } else {
        Write-Log ("  [!] تم العثور على {0} تهديد:" -f $threats.Count) 'Red'
        $names = Get-MpThreat -ErrorAction SilentlyContinue
        foreach ($t in $threats) {
            $n = ($names | Where-Object { $_.ThreatID -eq $t.ThreatID } | Select-Object -First 1).ThreatName
            Write-Log ("      - {0}  ->  {1}" -f $n, ($t.Resources -join ', ')) 'Red'
        }
        Remove-MpThreat -ErrorAction SilentlyContinue
        Write-Log '  [OK] تم حذف/عزل التهديدات المكتشفة. يُنصح بإعادة تشغيل الجهاز.' 'Green'
    }
}

function Invoke-OfflineScan {
    Write-Log "`n===== الفحص قبل الإقلاع (Offline Scan) =====" 'Yellow'
    Write-Log '  هذا الفحص يعيد تشغيل الجهاز ويفحصه قبل تحميل ويندوز (فعّال ضد الفيروسات المختبئة / Rootkits).' 'Cyan'
    Write-Log '  احفظ كل أعمالك المفتوحة قبل المتابعة. يستغرق حوالي 15 دقيقة.' 'Cyan'
    if (Confirm-Action '  هل تريد إعادة التشغيل الآن وبدء الفحص؟') {
        Start-MpWDOScan
    }
}

# ---------- 4) أكبر الملفات ----------
function Show-LargeFiles {
    Write-Log "`n===== أكبر الملفات في مجلدات المستخدمين (للعرض فقط - لا يتم حذف شيء) =====" 'Yellow'
    Write-Log '  ...جاري البحث' 'DarkGray'
    $files = Get-UserProfiles | ForEach-Object {
        Get-ChildItem -LiteralPath $_ -Recurse -Force -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Length -ge 300MB }
    } | Sort-Object Length -Descending | Select-Object -First 25

    if (-not $files) { Write-Log '  لا توجد ملفات أكبر من 300MB.' 'Green'; return }
    foreach ($f in $files) {
        Write-Log ("  {0,10}   {1}" -f (Format-Size $f.Length), $f.FullName) 'White'
    }
    Write-Log '  يمكنك نقل هذه الملفات إلى قرص آخر أو حذفها يدوياً إن لم تكن بحاجة لها.' 'Cyan'
}

# ---------- القائمة الرئيسية ----------
function Show-Summary([long]$StartFree) {
    $gain = (Get-FreeSpace) - $StartFree
    Write-Log "`n----------------------------------------" 'DarkGray'
    Write-Log ("المساحة التي تم تحريرها فعلياً على C: {0}" -f (Format-Size ([math]::Max(0, $gain)))) 'Magenta'
    Show-DiskInfo
    Write-Log ("تم حفظ السجل في: {0}" -f $LogFile) 'DarkGray'
}

while ($true) {
    Clear-Host
    Write-Host '==================================================' -ForegroundColor Cyan
    Write-Host '         WinCleaner  -  أداة تنظيف ويندوز          ' -ForegroundColor Cyan
    Write-Host '==================================================' -ForegroundColor Cyan
    Show-DiskInfo
    Write-Host ''
    Write-Host '  1) حذف الملفات المؤقتة والكاش (سريع)'
    Write-Host '  2) تنظيف عميق (تحديثات قديمة + أداة تنظيف القرص + السبات)'
    Write-Host '  3) فحص فيروسات سريع'
    Write-Host '  4) فحص فيروسات شامل'
    Write-Host '  5) الكل: تنظيف كامل + فحص فيروسات سريع  (مُوصى به)'
    Write-Host '  6) عرض أكبر الملفات التي تشغل المساحة'
    Write-Host '  7) فحص قبل الإقلاع (Offline) - يعيد تشغيل الجهاز'
    Write-Host '  0) خروج'
    Write-Host ''
    $choice = Read-Host 'اختر رقماً'

    $script:TotalFreed = 0
    $startFree = Get-FreeSpace
    switch ($choice) {
        '1' { Invoke-TempCleanup; Show-Summary $startFree }
        '2' { Invoke-DeepCleanup; Show-Summary $startFree }
        '3' { Invoke-VirusScan -Type QuickScan }
        '4' { Invoke-VirusScan -Type FullScan }
        '5' { Invoke-VirusScan -Type QuickScan; Invoke-TempCleanup; Invoke-DeepCleanup; Show-Summary $startFree }
        '6' { Show-LargeFiles }
        '7' { Invoke-OfflineScan }
        '0' { exit }
        default { Write-Host 'اختيار غير صحيح' -ForegroundColor Red }
    }
    Write-Host ''
    Read-Host 'اضغط Enter للعودة إلى القائمة'
}
