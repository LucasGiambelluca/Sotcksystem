/* 
   Sotcksystem Landing Page - JS
   Chat Demo & Animations 
*/

document.addEventListener('DOMContentLoaded', () => {
    // ── ANIMATIONS ON SCROLL ──
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Seleccionamos elementos para animar
    const animatedElements = document.querySelectorAll('.feature-card, .section-title, .hero-content, .pricing-card');
    animatedElements.forEach(el => {
        el.classList.add('hidden-anim');
        observer.observe(el);
    });

    // ── WHATSAPP DEMO SYSTEM ──
    const chatBody = document.getElementById('chat-body');
    const resetBtn = document.getElementById('reset-demo');

    const demoFlow = {
        start: {
            msg: "¡Hola! 🍕 Bienvenido a Rotisería El Delirio\n¿Querés hacer un pedido? Te paso el menú:",
            buttons: ["Ver Pizzas 🍕", "Ver Hamburguesas 🍔", "Empanadas 🥟"]
        },
        pizzas: {
            msg: "¡Excelente elección! Tenemos:\n\n1. Muzzarella - $4500\n2. Pepperoni - $5200\n3. Fugazzeta - $4800\n\n¿Cuál te gustaría pedir?",
            buttons: ["Una de muzzarella", "Una de pepperoni"]
        },
        delivery: {
            msg: "¡Perfecto! ¿Para delivery o retirás por el local?",
            buttons: ["Delivery 🛵", "Retiro en local 🏪"]
        },
        final: {
            msg: "¡Genial! Tu pedido fue recibido por el local. En unos minutos te avisamos cuando esté en camino.\n\n¡Gracias por elegirnos! 😊",
            buttons: ["Reiniciar Demo 🔄"]
        }
    };

    function addMessage(text, side = 'bot') {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${side}`;
        msgDiv.innerText = text;
        chatBody.appendChild(msgDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function addButtons(buttons, nextStep) {
        const btnContainer = document.createElement('div');
        btnContainer.className = 'chat-buttons';
        
        buttons.forEach(label => {
            const btn = document.createElement('button');
            btn.className = 'chat-btn';
            btn.innerText = label;
            btn.onclick = () => {
                handleUserChoice(label, nextStep);
                btnContainer.remove();
            };
            btnContainer.appendChild(btn);
        });
        
        chatBody.appendChild(btnContainer);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function handleUserChoice(choice, nextKey) {
        addMessage(choice, 'user');
        
        setTimeout(() => {
            runStep(nextKey);
        }, 800);
    }

    function runStep(key) {
        if (key === 'restart') {
            chatBody.innerHTML = '';
            runStep('start');
            return;
        }

        const step = demoFlow[key];
        addMessage(step.msg, 'bot');
        
        let nextKey = 'delivery';
        if (key === 'start') nextKey = 'pizzas';
        if (key === 'delivery') nextKey = 'final';
        if (key === 'final') nextKey = 'restart';

        setTimeout(() => {
            addButtons(step.buttons, nextKey);
        }, 500);
    }

    // Iniciar demo
    if (chatBody) {
        runStep('start');
    }

    if (resetBtn) {
        resetBtn.onclick = () => {
            chatBody.innerHTML = '';
            runStep('start');
        };
    }
});
