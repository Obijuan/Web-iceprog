function flash(sistema) {
    const btn = document.getElementById(`btn-${sistema}`);
    const cont = document.getElementById(`prog-cont-${sistema}`);
    const bar = document.getElementById(`prog-bar-${sistema}`);

    // 1. Bloquear interfaz
    btn.disabled = true;
    btn.innerText = "Grabando...";
    cont.style.display = "block";
    
    let progreso = 0;

    // 2. Simulación de carga (sustituir por lógica WebUSB real después)
    const intervalo = setInterval(() => {
        progreso += Math.random() * 15; // Incrementos aleatorios
        
        if (progreso >= 100) {
            progreso = 100;
            clearInterval(intervalo);
            
            // 3. Finalización
            bar.style.width = "100%";
            btn.innerText = "¡Completado!";
            btn.style.borderColor = "#44ff44";
            btn.style.color = "#44ff44";
            
            setTimeout(() => {
                // Resetear tras 3 segundos
                cont.style.display = "none";
                bar.style.width = "0%";
                btn.disabled = false;
                btn.innerText = "Grabar Bitstream";
                btn.style.borderColor = ""; 
                btn.style.color = "";
            }, 3000);
        }
        
        bar.style.width = progreso + "%";
    }, 200);
}

