export class IntentClassifier {
    private intents: any[] = [
        {
            id: 'ORDER_FLOW',
            keywords: ['pedir', 'ordenar', 'comprar', 'quiero'],
            regex: [/^(me gustaría|quisiera|deseo) (pedir|ordenar)/i]
        },
        {
            id: 'SUPPORT_FLOW',
            keywords: ['ayuda', 'soporte', 'problema', 'no funciona'],
            regex: [/(ayuda|soporte)/i]
        }
    ];

    async classify(text: string): Promise<string | null> {
        const lowerText = text.toLowerCase();
        
        for (const intent of this.intents) {
            // Check keywords
            if (intent.keywords.some((kw: string) => lowerText.includes(kw))) {
                return intent.id;
            }

            // Check regex
            if (intent.regex.some((rx: RegExp) => rx.test(text))) {
                return intent.id;
            }
        }

        return null; // Fallback or unknown
    }
}
