$content = Get-Content 'src\components\PlayableChessboard.tsx' -Raw
$content = $content -replace "    if \(version.model_glb\) return \{ url: buildUrl\(version.model_glb\), type: 'glb' \};\r?\n  \r?\n  function squareToPosition", "    if (version.model_glb) return { url: buildUrl(version.model_glb), type: 'glb' as const };
    return null;
  }
  
  function squareToPosition"
Set-Content 'src\components\PlayableChessboard.tsx' -Value $content
