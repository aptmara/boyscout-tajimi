Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

base = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = fso.BuildPath(base, "tools\commit-and-push.ps1")

If Not fso.FileExists(ps1) Then
    MsgBox "tools\commit-and-push.ps1 not found.", vbCritical, "Error"
    WScript.Quit 1
End If

pwsh = ""
If fso.FileExists("C:\Program Files\PowerShell\7\pwsh.exe") Then
    pwsh = """C:\Program Files\PowerShell\7\pwsh.exe"""
Else
    On Error Resume Next
    pwshPath = shell.ExpandEnvironmentStrings("%PATH%")
    For Each part In Split(pwshPath, ";")
        cand = fso.BuildPath(part, "pwsh.exe")
        If fso.FileExists(cand) Then
            pwsh = """" & cand & """"
            Exit For
        End If
    Next
    On Error GoTo 0
End If

If pwsh = "" Then
    MsgBox "PowerShell 7 (pwsh.exe) not found. Install it and retry.", vbCritical, "Error"
    WScript.Quit 1
End If

cmdLine = pwsh & " -NoExit -ExecutionPolicy Bypass -NoProfile -STA -File """ & ps1 & """"
shell.Run cmdLine, 1, False
