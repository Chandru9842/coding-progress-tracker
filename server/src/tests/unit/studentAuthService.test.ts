export async function testStudentAuthServiceLogic(): Promise<{ name: string; passed: boolean; message?: string }> {
  const testName = 'Unit Test: Student Responsibility Authorization Logic';
  try {
    // Datastores
    const staffStudentAssignments = [
      { staffId: 'staff1', studentId: 's1' },
      { staffId: 'staff1', studentId: 's2' },
    ];
    const staffSectionAssignments = [
      { staffId: 'staff2', sectionId: 'secA', mode: 'ALL' as const },
    ];
    const students = [
      { id: 's1', sectionId: 'secA' },
      { id: 's2', sectionId: 'secA' },
      { id: 's3', sectionId: 'secA' },
      { id: 's4', sectionId: 'secB' },
    ];

    const isAuthorized = (staffId: string, studentId: string) => {
      // 1. Direct assignment
      if (staffStudentAssignments.some((sa) => sa.staffId === staffId && sa.studentId === studentId)) {
        return true;
      }
      // 2. Section ALL assignment
      const student = students.find((s) => s.id === studentId);
      if (student && staffSectionAssignments.some((sa) => sa.staffId === staffId && sa.sectionId === student.sectionId && sa.mode === 'ALL')) {
        return true;
      }
      return false;
    };

    // Staff 1 direct assignment checks
    if (!isAuthorized('staff1', 's1') || !isAuthorized('staff1', 's2')) {
      return { name: testName, passed: false, message: 'Direct student assignment resolution failed' };
    }
    if (isAuthorized('staff1', 's3')) {
      return { name: testName, passed: false, message: 'Staff 1 improperly authorized for unassigned Student s3' };
    }

    // Staff 2 section ALL checks
    if (!isAuthorized('staff2', 's1') || !isAuthorized('staff2', 's2') || !isAuthorized('staff2', 's3')) {
      return { name: testName, passed: false, message: 'Section ALL assignment resolution failed for secA' };
    }
    if (isAuthorized('staff2', 's4')) {
      return { name: testName, passed: false, message: 'Staff 2 improperly authorized for secB Student s4' };
    }

    return { name: testName, passed: true };
  } catch (err: any) {
    return { name: testName, passed: false, message: err.message };
  }
}
