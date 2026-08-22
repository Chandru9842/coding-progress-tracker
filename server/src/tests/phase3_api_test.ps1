# Phase 3 API Integration Test Script
# Tests all CRUD operations via direct HTTP calls

$baseUrl = "http://localhost:5000/api/v1"

Write-Host "=========================================="
Write-Host "PHASE 3 — REAL API INTEGRATION TEST"
Write-Host "=========================================="

# 1. Health Check
Write-Host "`n--- Test 1: Health Check ---"
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
Write-Host "Health: $($health.status)" -ForegroundColor $(if($health.status -eq "ok"){"Green"}else{"Red"})

# 2. Admin Login
Write-Host "`n--- Test 2: Admin Login ---"
$loginBody = @{ email = "admin@college.edu"; password = "AdminPass123!" } | ConvertTo-Json
try {
    $loginResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -SessionVariable session
    $loginData = $loginResp.Content | ConvertFrom-Json
    Write-Host "Admin Login: SUCCESS — $($loginData.user.email) ($($loginData.user.role))" -ForegroundColor Green
    $token = $loginData.token
} catch {
    Write-Host "Admin Login: FAILED — $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

# 3. Get Batches (should be empty)
Write-Host "`n--- Test 3: GET /batches (empty) ---"
$batches = Invoke-RestMethod -Uri "$baseUrl/batches" -Method Get -Headers $headers
Write-Host "Batches count: $($batches.batches.Count)" -ForegroundColor $(if($batches.batches.Count -eq 0){"Green"}else{"Yellow"})

# 4. Create Batch
Write-Host "`n--- Test 4: POST /batches (Create Batch 2023-2027) ---"
$batchBody = @{ batch_name = "2023-2027"; start_year = 2023; end_year = 2027; department = "CSE" } | ConvertTo-Json
$newBatch = Invoke-RestMethod -Uri "$baseUrl/batches" -Method Post -Headers $headers -Body $batchBody
$batchId = $newBatch.batch.id
Write-Host "Created Batch: $($newBatch.batch.batch_name) ID=$batchId" -ForegroundColor Green

# 5. Get Batch Detail
Write-Host "`n--- Test 5: GET /batches/$batchId ---"
$batchDetail = Invoke-RestMethod -Uri "$baseUrl/batches/$batchId" -Method Get -Headers $headers
Write-Host "Batch Detail: $($batchDetail.batch.batch_name) ($($batchDetail.batch.department))" -ForegroundColor Green

# 6. Create Section CSE-A
Write-Host "`n--- Test 6: POST /batches/$batchId/sections (CSE-A) ---"
$secBody = @{ name = "CSE-A" } | ConvertTo-Json
$newSec = Invoke-RestMethod -Uri "$baseUrl/batches/$batchId/sections" -Method Post -Headers $headers -Body $secBody
$sectionId = $newSec.section.id
Write-Host "Created Section: $($newSec.section.name) ID=$sectionId" -ForegroundColor Green

# 7. Duplicate Section Check (409)
Write-Host "`n--- Test 7: Duplicate Section CSE-A (expect 409) ---"
try {
    $dupSec = Invoke-RestMethod -Uri "$baseUrl/batches/$batchId/sections" -Method Post -Headers $headers -Body $secBody
    Write-Host "Duplicate Section: SHOULD HAVE FAILED" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Duplicate Section rejected: HTTP $statusCode" -ForegroundColor $(if($statusCode -eq 409){"Green"}else{"Red"})
}

# 8. Create Student
Write-Host "`n--- Test 8: POST /students (REG2023001 Alice Smith) ---"
$studentBody = @{
    register_number = "REG2023001"
    name = "Alice Smith"
    department = "CSE"
    batch_id = $batchId
    section_id = $sectionId
    leetcode_username = "alice_code"
} | ConvertTo-Json
$newStudent = Invoke-RestMethod -Uri "$baseUrl/students" -Method Post -Headers $headers -Body $studentBody
$studentId = $newStudent.student.id
Write-Host "Created Student: $($newStudent.student.name) ($($newStudent.student.register_number)) ID=$studentId" -ForegroundColor Green

# 9. Duplicate Register Number Check (409)
Write-Host "`n--- Test 9: Duplicate Register Number REG2023001 (expect 409) ---"
try {
    $dupStudent = Invoke-RestMethod -Uri "$baseUrl/students" -Method Post -Headers $headers -Body $studentBody
    Write-Host "Duplicate Student: SHOULD HAVE FAILED" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Duplicate Register Number rejected: HTTP $statusCode" -ForegroundColor $(if($statusCode -eq 409){"Green"}else{"Red"})
}

# 10. Get Student Detail
Write-Host "`n--- Test 10: GET /students/$studentId ---"
$studentDetail = Invoke-RestMethod -Uri "$baseUrl/students/$studentId" -Method Get -Headers $headers
Write-Host "Student Detail: $($studentDetail.student.name) Reg=$($studentDetail.student.register_number) LeetCode=$($studentDetail.student.leetcode_username)" -ForegroundColor Green

# 11. Update Student
Write-Host "`n--- Test 11: PATCH /students/$studentId ---"
$updateBody = @{ name = "Alice Jane Smith"; leetcode_username = "alice_jane_lc" } | ConvertTo-Json
$updatedStudent = Invoke-RestMethod -Uri "$baseUrl/students/$studentId" -Method Patch -Headers $headers -Body $updateBody
Write-Host "Updated Student: $($updatedStudent.student.name) LeetCode=$($updatedStudent.student.leetcode_username)" -ForegroundColor Green

# 12. Search Students
Write-Host "`n--- Test 12: GET /students?search=alice ---"
$searchResult = Invoke-RestMethod -Uri "$baseUrl/students?search=alice" -Method Get -Headers $headers
Write-Host "Search 'alice': $($searchResult.students.Count) result(s)" -ForegroundColor $(if($searchResult.students.Count -ge 1){"Green"}else{"Red"})

# 13. Filter by Batch
Write-Host "`n--- Test 13: GET /students?batchId=$batchId ---"
$filterResult = Invoke-RestMethod -Uri "$baseUrl/students?batchId=$batchId" -Method Get -Headers $headers
Write-Host "Filter by Batch: $($filterResult.students.Count) result(s)" -ForegroundColor $(if($filterResult.students.Count -ge 1){"Green"}else{"Red"})

# 14. Create Staff (Muthuraj)
Write-Host "`n--- Test 14: POST /staff (Muthuraj Sir) ---"
$staffBody = @{ name = "Muthuraj Sir"; email = "muthuraj@college.edu"; password = "Pass123!" } | ConvertTo-Json
$newStaff = Invoke-RestMethod -Uri "$baseUrl/staff" -Method Post -Headers $headers -Body $staffBody
$staffId = $newStaff.staff.id
Write-Host "Created Staff: $($newStaff.staff.name) ($($newStaff.staff.email)) ID=$staffId" -ForegroundColor Green

# 15. Staff Login
Write-Host "`n--- Test 15: Staff Login (Muthuraj) ---"
$staffLoginBody = @{ email = "muthuraj@college.edu"; password = "Pass123!" } | ConvertTo-Json
$staffLoginResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method Post -Body $staffLoginBody -ContentType "application/json"
$staffLoginData = $staffLoginResp.Content | ConvertFrom-Json
$staffToken = $staffLoginData.token
Write-Host "Staff Login: SUCCESS — $($staffLoginData.user.email) ($($staffLoginData.user.role))" -ForegroundColor Green

$staffHeaders = @{ "Authorization" = "Bearer $staffToken"; "Content-Type" = "application/json" }

# 16. Staff sees 0 students (no assignment yet)
Write-Host "`n--- Test 16: Staff GET /students (no assignments) ---"
$staffStudents = Invoke-RestMethod -Uri "$baseUrl/students" -Method Get -Headers $staffHeaders
Write-Host "Staff sees: $($staffStudents.students.Count) students (Expected: 0)" -ForegroundColor $(if($staffStudents.students.Count -eq 0){"Green"}else{"Red"})

# 17. Staff cannot create students (403)
Write-Host "`n--- Test 17: Staff POST /students (expect 403) ---"
try {
    $staffCreate = Invoke-RestMethod -Uri "$baseUrl/students" -Method Post -Headers $staffHeaders -Body $studentBody
    Write-Host "Staff Create Student: SHOULD HAVE FAILED" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Staff Create Student rejected: HTTP $statusCode" -ForegroundColor $(if($statusCode -eq 403){"Green"}else{"Red"})
}

# 18. Staff cannot access unauthorized student (403)
Write-Host "`n--- Test 18: Staff GET /students/$studentId (expect 403) ---"
try {
    $staffStudentDetail = Invoke-RestMethod -Uri "$baseUrl/students/$studentId" -Method Get -Headers $staffHeaders
    Write-Host "Staff Access Unauthorized Student: SHOULD HAVE FAILED" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Staff Unauthorized Student Access rejected: HTTP $statusCode" -ForegroundColor $(if($statusCode -eq 403){"Green"}else{"Red"})
}

# 19. Update Batch
Write-Host "`n--- Test 19: PATCH /batches/$batchId ---"
$patchBatch = @{ department = "Computer Science" } | ConvertTo-Json
$updBatch = Invoke-RestMethod -Uri "$baseUrl/batches/$batchId" -Method Patch -Headers $headers -Body $patchBatch
Write-Host "Updated Batch Department: $($updBatch.batch.department)" -ForegroundColor Green

# 20. Delete Student
Write-Host "`n--- Test 20: DELETE /students/$studentId ---"
$delStudent = Invoke-RestMethod -Uri "$baseUrl/students/$studentId" -Method Delete -Headers $headers
Write-Host "Delete Student: $($delStudent.message)" -ForegroundColor Green

# 21. 404 Route
Write-Host "`n--- Test 21: GET /api/v1/nonexistent (expect 404) ---"
try {
    $notFound = Invoke-RestMethod -Uri "$baseUrl/nonexistent" -Method Get -Headers $headers
    Write-Host "404 Test: Unexpected success" -ForegroundColor Red
} catch {
    Write-Host "404 Route: Correctly returned error" -ForegroundColor Green
}

Write-Host "`n=========================================="
Write-Host "PHASE 3 API INTEGRATION TEST COMPLETE"
Write-Host "=========================================="
