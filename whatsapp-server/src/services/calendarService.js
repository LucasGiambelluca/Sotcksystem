class CalendarService {
    async createEvent(eventDetails) {
        // Valid for V2
        console.log('Skipping Google Calendar for V1');
        return true;
    }
}

module.exports = new CalendarService();
