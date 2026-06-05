# Patch all app/(app)/*/page.tsx to use getCachedUser() instead of duplicate getUser() calls
$root = "D:\Vinus Agent\vinus-finance\app\(app)"
$files = Get-ChildItem -Path $root -Recurse -Filter "page.tsx" | Where-Object { $_.FullName -notlike "*node_modules*" }

$importOld = "import { createClient } from '@/lib/supabase/server'`r`nimport { redirect } from 'next/navigation'"
$importNew = "import { createClient } from '@/lib/supabase/server'`r`nimport { getCachedUser } from '@/lib/supabase/get-user'`r`nimport { redirect } from 'next/navigation'"

# Also handle without \r
$importOldLF = "import { createClient } from '@/lib/supabase/server'`nimport { redirect } from 'next/navigation'"
$importNewLF = "import { createClient } from '@/lib/supabase/server'`nimport { getCachedUser } from '@/lib/supabase/get-user'`nimport { redirect } from 'next/navigation'"

$bodyOld = "  const supabase = await createClient()`r`n  const { data: { user } } = await supabase.auth.getUser()`r`n  if (!user) redirect('/login')"
$bodyNew = "  const user = await getCachedUser()`r`n  if (!user) redirect('/login')`r`n  const supabase = await createClient()"

$bodyOldLF = "  const supabase = await createClient()`n  const { data: { user } } = await supabase.auth.getUser()`n  if (!user) redirect('/login')"
$bodyNewLF = "  const user = await getCachedUser()`n  if (!user) redirect('/login')`n  const supabase = await createClient()"

$count = 0
foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw

    # Skip if already patched
    if ($content -match "getCachedUser") {
        Write-Host "  SKIP (already patched): $($file.Name) in $($file.Directory.Name)"
        continue
    }

    # Skip if doesn't have the pattern
    if (-not ($content -match "supabase\.auth\.getUser")) {
        Write-Host "  SKIP (no getUser): $($file.Name) in $($file.Directory.Name)"
        continue
    }

    $newContent = $content

    # Patch imports (CRLF)
    $newContent = $newContent.Replace($importOld, $importNew)
    # Patch imports (LF)
    $newContent = $newContent.Replace($importOldLF, $importNewLF)

    # Patch body (CRLF)
    $newContent = $newContent.Replace($bodyOld, $bodyNew)
    # Patch body (LF)
    $newContent = $newContent.Replace($bodyOldLF, $bodyNewLF)

    if ($newContent -ne $content) {
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        Write-Host "  PATCHED: $($file.Name) in $($file.Directory.Name)"
        $count++
    } else {
        Write-Host "  WARN (pattern mismatch): $($file.Name) in $($file.Directory.Name)"
    }
}

Write-Host ""
Write-Host "Done. Patched $count files."
