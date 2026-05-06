
// Mocking the environment for testing the logic
const timezone = 'America/Argentina/Buenos_Aires';
const specialClosures = ['2026-05-01', '2026-05-25'];

function checkSpecialClosure(now, closures, tz) {
    const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const dParts = datePartsFormatter.formatToParts(now);
    const y = dParts.find(p => p.type === 'year')?.value;
    const m = dParts.find(p => p.type === 'month')?.value;
    const d = dParts.find(p => p.type === 'day')?.value;
    const currentDateStr = `${y}-${m}-${d}`;
    
    console.log(`Checking date: ${currentDateStr}`);
    return closures.includes(currentDateStr);
}

// Test cases
const testDate1 = new Date('2026-05-01T12:00:00Z'); // Should be closed (May 1st)
const testDate2 = new Date('2026-05-02T12:00:00Z'); // Should be open (May 2nd)

console.log(`Test 1 (May 1st): ${checkSpecialClosure(testDate1, specialClosures, timezone) ? 'CLOSED (Correct)' : 'OPEN (Incorrect)'}`);
console.log(`Test 2 (May 2nd): ${checkSpecialClosure(testDate2, specialClosures, timezone) ? 'CLOSED (Incorrect)' : 'OPEN (Correct)'}`);
