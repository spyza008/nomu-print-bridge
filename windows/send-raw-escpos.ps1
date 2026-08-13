param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath
)

$source = @'
using System;
using System.Runtime.InteropServices;
public static class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern int StartDocPrinter(IntPtr handle, int level, [In] DOCINFO docInfo);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr handle, byte[] data, int count, out int written);
}
'@
Add-Type -TypeDefinition $source
$data = [System.IO.File]::ReadAllBytes($FilePath)
$handle = [IntPtr]::Zero
if (-not [RawPrinter]::OpenPrinter($PrinterName, [ref]$handle, [IntPtr]::Zero)) { throw "Cannot open printer '$PrinterName'. Windows error: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
try {
  $doc = New-Object RawPrinter+DOCINFO
  $doc.pDocName = 'Nomu receipt'
  $doc.pDataType = 'RAW'
  if ([RawPrinter]::StartDocPrinter($handle, 1, $doc) -le 0) { throw 'Could not start print job' }
  try {
    if (-not [RawPrinter]::StartPagePrinter($handle)) { throw 'Could not start print page' }
    try { $written = 0; if (-not [RawPrinter]::WritePrinter($handle, $data, $data.Length, [ref]$written) -or $written -ne $data.Length) { throw 'Could not write all print data' } }
    finally { [RawPrinter]::EndPagePrinter($handle) | Out-Null }
  } finally { [RawPrinter]::EndDocPrinter($handle) | Out-Null }
} finally { [RawPrinter]::ClosePrinter($handle) | Out-Null }
