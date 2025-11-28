#requires -Version 7.0

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Show-ErrorDialog {
    param([string]$Message)
    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        "エラー",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Show-InfoDialog {
    param([string]$Message, [string]$Title = "完了")
    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        $Title,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
}

function Fail-AndThrow {
    param([string]$Message)
    Show-ErrorDialog $Message
    throw $Message
}

function Ensure-GitAvailable {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Fail-AndThrow "git が見つかりません。Git がインストールされているか確認してください。"
    }

    git rev-parse --is-inside-work-tree *> $null
    if ($LASTEXITCODE -ne 0) {
        Fail-AndThrow "このスクリプトは Git 管理下のリポジトリ内で実行してください。"
    }
}

function Invoke-GitOrFail {
    param(
        [string[]]$GitArgs,
        [string]$ActionLabel
    )

    Write-Host ">>> git $($GitArgs -join ' ')" -ForegroundColor Cyan
    $output = git @GitArgs 2>&1
    if (-not [string]::IsNullOrWhiteSpace($output)) {
        Write-Host $output
    }
    if ($LASTEXITCODE -ne 0) {
        Fail-AndThrow "$ActionLabel に失敗しました。`n$output"
    }

    return $output
}

function Get-CommitMessageFromDialog {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Commit & Push"
    $form.Size = New-Object System.Drawing.Size(420, 180)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false

    $label = New-Object System.Windows.Forms.Label
    $label.Text = "コミットメッセージを入力してください。"
    $label.AutoSize = $true
    $label.Location = New-Object System.Drawing.Point(12, 12)
    $form.Controls.Add($label)

    $textBox = New-Object System.Windows.Forms.TextBox
    $textBox.Location = New-Object System.Drawing.Point(12, 35)
    $textBox.Size = New-Object System.Drawing.Size(380, 60)
    $textBox.Multiline = $true
    $textBox.ScrollBars = "Vertical"
    $form.Controls.Add($textBox)

    $okButton = New-Object System.Windows.Forms.Button
    $okButton.Text = "実行"
    $okButton.Size = New-Object System.Drawing.Size(75, 30)
    $okButton.Location = New-Object System.Drawing.Point(236, 105)
    $okButton.Add_Click({
        if ([string]::IsNullOrWhiteSpace($textBox.Text)) {
            [System.Windows.Forms.MessageBox]::Show(
                "コミットメッセージを入力してください。",
                "入力不足",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Warning
            ) | Out-Null
            return
        }

        $form.Tag = $textBox.Text.Trim()
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    })
    $form.Controls.Add($okButton)
    $form.AcceptButton = $okButton

    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "キャンセル"
    $cancelButton.Size = New-Object System.Drawing.Size(75, 30)
    $cancelButton.Location = New-Object System.Drawing.Point(317, 105)
    $cancelButton.Add_Click({
        $form.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
        $form.Close()
    })
    $form.Controls.Add($cancelButton)

    $dialogResult = $form.ShowDialog()
    if ($dialogResult -ne [System.Windows.Forms.DialogResult]::OK) {
        return $null
    }

    return [string]$form.Tag
}

$global:ExitCode = 0

try {
    Ensure-GitAvailable

    $statusOutput = Invoke-GitOrFail -GitArgs @("status", "--porcelain") -ActionLabel "変更の確認"
    if ([string]::IsNullOrWhiteSpace($statusOutput)) {
        Write-Host "コミット対象の変更がありません。"
        Show-InfoDialog "コミット対象の変更がありません。" "情報"
        return
    }

    $commitMessage = Get-CommitMessageFromDialog
    if (-not $commitMessage) {
        Write-Host "キャンセルしました。"
        $global:ExitCode = 1
        return
    }

    Invoke-GitOrFail -GitArgs @("add", "-A") -ActionLabel "git add"
    Invoke-GitOrFail -GitArgs @("commit", "-m", $commitMessage) -ActionLabel "git commit"
    Invoke-GitOrFail -GitArgs @("push") -ActionLabel "git push"

    Show-InfoDialog "push まで完了しました。" "成功"
}
catch {
    $global:ExitCode = 1
    if (-not $PSItem.Exception.Message.Contains("コミットする変更がありません。")) {
        # すでに Fail-AndThrow でメッセージを表示済み
        Write-Error $PSItem
    }
}
finally {
    if ($env:COMMIT_AND_PUSH_KEEP_OPEN -ne "1" -and $env:COMMIT_AND_PUSH_NO_PAUSE -ne "1") {
        Write-Host ""
        Write-Host "処理が完了しました。何かキーを押すとウィンドウを閉じます。"
        Read-Host
    }
}

if ($env:COMMIT_AND_PUSH_KEEP_OPEN -eq "1") {
    Write-Host ""
    Write-Host "終了コード: $global:ExitCode"
    Write-Host "このウィンドウは自動では閉じません。必要なら手動で閉じてください。"
} else {
    exit $global:ExitCode
}
