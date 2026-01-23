$srcDir = "$PSScriptRoot/src"
$distDir = "$PSScriptRoot/dist"
$commonDir = "$PSScriptRoot/common"
$listsDir = "$PSScriptRoot/lists"

# Import v2 Mapper
. "$PSScriptRoot/map-v2.ps1"

$header = Get-Content "$commonDir/header.sieve" -Raw
$preGuard = Get-Content "$commonDir/pre_guard.sieve" -Raw
$postGuard = Get-Content "$commonDir/post_guard.sieve" -Raw

# Ensure dist exists
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

# Files that need the guard block
$guarded = @(
    "alert.sieve", "auto.sieve", "bills.sieve", "deal.sieve", 
    "entertainment.sieve", "logs.sieve", "news.sieve", "notice.sieve", 
    "phone.sieve", "receipt.sieve", "reminder.sieve", "reporting.sieve", 
    "reputation.sieve", "reward.sieve", "security.sieve", "shipping.sieve",
    "social.sieve", "storage.sieve", "survey.sieve", "ticket.sieve", 
    "travel.sieve", "charity.sieve"
)

# Process .sieve files
Get-ChildItem -Path $srcDir -Filter "*.sieve" | ForEach-Object {
    $currentFile = $_
    $ruleName = $currentFile.BaseName
    $content = Get-Content $currentFile.FullName -Raw

    # CHECK FOR V2 TEMPLATE INDICATOR
    # If the src file is just `# Template: v2`, we swap the content with the master template
    if ($content.Trim() -eq "# Template: v2") {
        $content = Get-Content "$srcDir/template-v2.sieve" -Raw
        
        # Inject Rule Name
        $content = $content.Replace("{{RULE_NAME}}", [cultureinfo]::CurrentCulture.TextInfo.ToTitleCase($ruleName))
        $content = $content.Replace("{{RULE_NAME_LOWER}}", $ruleName.ToLower())
        
        # Load the new rules.txt
        $v2RulesPath = Join-Path $listsDir "$ruleName/rules.txt"
        $parsedBuckets = Parse-RulesFile -Path $v2RulesPath
    } elseif ($content.Trim() -eq "# Template: v3") {
        $content = Get-Content "$srcDir/template-v3.sieve" -Raw
        
        # Inject Rule Name
        $content = $content.Replace("{{RULE_NAME}}", [cultureinfo]::CurrentCulture.TextInfo.ToTitleCase($ruleName))
        $content = $content.Replace("{{RULE_NAME_LOWER}}", $ruleName.ToLower())
        
        # Load the new rules.txt
        $v2RulesPath = Join-Path $listsDir "$ruleName/rules.txt"
        $parsedBuckets = Parse-RulesFile -Path $v2RulesPath
    } else {
        $parsedBuckets = $null
    }

    # Template Injection
    # Supports {{LIST:path}} or {{LIST:path:mode}}
    $content = [Regex]::Replace($content, "\{\{LIST:([\w\-\/]+)(?::(\w+))?\}\}", {
        param($match)
        $listReference = $match.Groups[1].Value
        $mode = if ($match.Groups[2].Success) { $match.Groups[2].Value } else { "all" }
        
        # Split rule/listname
        $parts = $listReference -split "/"
        
        # Handle v2 Data Injection
        if ($parsedBuckets -ne $null) {
             # Support both `rule/bucket` and just `bucket`
             $bucketKey = if ($parts.Length -eq 2) { $parts[1] } else { $parts[0] }

             if ($parsedBuckets.ContainsKey($bucketKey)) {
                 $lines = $parsedBuckets[$bucketKey]
                 if ($null -ne $lines) {
                    # Filter based on mode
                    if ($mode -eq "contains") {
                        $lines = $lines | Where-Object { $_ -notmatch "[\*\?]" }
                    } elseif ($mode -eq "matches") {
                        $lines = $lines | Where-Object { $_ -match "[\*\?]" }
                    }

                    # Format using the same logic as standard file lists
                    $formatted = $lines | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }
                    if ($null -ne $formatted -and $formatted.Count -gt 0) {
                         return $formatted -join ", "
                    }
                 }
                 return '"__IGNORE__"'
             }
        }

        # --- Standard File Logic for v1 ---
        $listPath = Join-Path $listsDir "$listReference.txt"
        
        $result = "" 
        if (Test-Path $listPath) {
            $lines = Get-Content $listPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            
            # Filter based on mode
            if ($mode -eq "contains") {
                $lines = $lines | Where-Object { $_ -notmatch "[\*\?]" }
            } elseif ($mode -eq "matches") {
                $lines = $lines | Where-Object { $_ -match "[\*\?]" }
            }
            
            # Escape quotes and wrap in quotes
            $formatted = $lines | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }
            if ($null -ne $formatted -and $formatted.Count -gt 0) {
                 $result = $formatted -join ", "
            }
        }

        # Handle empty result to prevent syntax errors in Sieve (empty list [])
        if ([string]::IsNullOrWhiteSpace($result)) {
            return '"__IGNORE__"'
        }
        return $result
    })

    $outFile = Join-Path $distDir ($currentFile.Name -replace "\.sieve$", ".txt")

    # Extract version header
    $versionHeader = ""
    if ($content -match "(?m)^# Template: v\d+") {
        $versionHeader = $matches[0]
        $content = $content -replace "(?m)^# Template: v\d+.*(\r?\n)?", ""
    }

    $finalContent = ""
    
    # V2 Logic: Self-contained template
    if ($parsedBuckets -ne $null) {
        $finalContent = $versionHeader + "`n" + $content
    } 
    # V1 Logic: Assemble parts
    else {
        if ($versionHeader) {
            $finalContent += $versionHeader + "`n"
        }
        $finalContent += $header

        if ($guarded -contains $_.Name) {
            $finalContent += "`n" + $preGuard
            $finalContent += $content
            $finalContent += $postGuard + "`n"
        } else {
            $finalContent += "`n" + $content
        }
    }

    $finalContent | Set-Content $outFile -Encoding UTF8
    Write-Host "Built $outFile"
}
