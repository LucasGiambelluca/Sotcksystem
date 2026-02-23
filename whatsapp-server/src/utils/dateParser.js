class DateParser {
    static parse(text) {
        const clean = text.toLowerCase().trim();
        const result = { date: null, timeSlot: null, original: text };
        
        const now = new Date();
        let targetDate = new Date(); // Default to today

        // 1. Detect Day
        if (clean.includes('mañana') || clean.includes('manana')) {
            targetDate.setDate(now.getDate() + 1);
        } else if (clean.includes('hoy')) {
            // Already today
        } else {
            // Try to find a weekday? ignored for now V1
            // Default: if it says "lunes", we assume next monday. 
            // For now, default to tomorrow if unclear, or today?
            // Let's default to tomorrow if time > 20hs today?
            // Simplified: Default is "Today" if unspecified.
        }

        // 2. Detect Time
        // Regex for things like: 15hs, 15:30, 3pm, 20.00
        const timeRegex = /(\d{1,2})[:\.]?(\d{2})?\s*(hs|hrs|am|pm)?/i;
        const timeMatch = clean.match(timeRegex);

        if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const period = timeMatch[3];

            // PM logic
            if (period === 'pm' && hour < 12) hour += 12;
            if (period === 'am' && hour === 12) hour = 0;
            
            // "15 hs" logic -> 15
            
            // Set time on date
            targetDate.setHours(hour, minute, 0, 0);
            
            // Create Time Slot string
            const endHour = hour + 1;
            result.timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} - ${endHour.toString().padStart(2, '0')}:00`;
        } else {
            // Default time?
            // If no time specified, maybe null?
            result.timeSlot = "A coordinar";
        }

        result.date = targetDate;
        
        // Format YYYY-MM-DD for DB
        result.formattedDate = targetDate.toISOString().split('T')[0];

        return result;
    }
}

module.exports = DateParser;
