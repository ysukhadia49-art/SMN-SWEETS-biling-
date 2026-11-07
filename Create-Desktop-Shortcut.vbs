Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.SpecialFolders("Desktop") & "\SMN SWEET'S Billing.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)

sCurrentDir = oWS.CurrentDirectory
oLink.TargetPath = sCurrentDir & "\Launch-SMN-Sweets.bat"
oLink.WorkingDirectory = sCurrentDir
oLink.Description = "SMN SWEET'S Traditional Sweet Shop Billing & PDF Invoice Management System"
If CreateObject("Scripting.FileSystemObject").FileExists(sCurrentDir & "\assets\smn-logo.png") Then
  oLink.IconLocation = sCurrentDir & "\assets\smn-logo.png"
End If
oLink.Save
WScript.Echo "Desktop shortcut created successfully on your Windows Desktop!"

