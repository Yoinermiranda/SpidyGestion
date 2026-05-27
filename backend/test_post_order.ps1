try {
  $login = Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/auth/login' -ContentType 'application/json' -Body (ConvertTo-Json @{ pin = '0000' })
  Write-Output "TOKEN: $($login.token)"
  $body = @{ tipo_pedido = 'LOCAL'; id_mesa = 1; items = @(@{ id_producto = 1; cantidad = 1 }) }
  $json = $body | ConvertTo-Json -Depth 5
  $resp = Invoke-WebRequest -Method Post -Uri 'http://localhost:5000/api/orders' -Headers @{ Authorization = "Bearer $($login.token)" } -ContentType 'application/json' -Body $json -UseBasicParsing -ErrorAction Stop
  Write-Output "STATUS: $($resp.StatusCode)"
  Write-Output $resp.Content
} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
  if ($_.Exception.Response -ne $null) {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Output "RESPONSE_BODY:"
    Write-Output $reader.ReadToEnd()
  }
}
