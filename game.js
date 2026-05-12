const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let state = {
    distance: 0,
    fuel: 100,
    supplies: 50,
    energy: 100,
    day: 1,
    patientsTreated: 0,
    gameOver: false,
    win: false,
    awaitingChoice: false,
    currentEvent: null
};

const GOAL_DISTANCE = 500;

const instantEvents = [
    { text: "Hit a pothole. Lost 5 fuel.", fuel: -5, supplies: 0, energy: 0 },
    { text: "Staff burnout. Lost 15 energy.", fuel: 0, supplies: 0, energy: -15 },
    { text: "Found a local gas station. +10 fuel.", fuel: 10, supplies: 0, energy: 0 },
    { text: "Donation of supplies! +10 meds.", fuel: 0, supplies: 10, energy: 0 },
    { text: "Smooth driving today.", fuel: 0, supplies: 0, energy: 0 },
    { text: "Traffic jam. Wasted 5 fuel.", fuel: -5, supplies: 0, energy: -5 },
    { text: "Rough roads. Van took a beating.", fuel: -5, supplies: -5, energy: 0 },
    { text: "Found an abandoned fuel can! +15 fuel.", fuel: 15, supplies: 0, energy: 0 }
];

const interactiveEvents = [
    {
        text: "A patient arrives at the clinic with severe, unknown coughing symptoms.",
        choices: [
            {
                text: "Treat aggressively with Meds (-10 Meds)",
                cost: { supplies: 10 },
                roll: true,
                successRoll: 10,
                success: {
                    outcome: "Patient stabilized! They donated fuel. (+10 Fuel)",
                    effect: { fuel: 10, patients: 1 }
                },
                fail: {
                    outcome: "Treatment was ineffective. The patient left to a hospital.",
                    effect: {}
                }
            },
            {
                text: "Examine them closely without PPE (-5 Energy)",
                cost: { energy: 5 },
                roll: true,
                successRoll: 12,
                success: {
                    outcome: "You safely diagnosed and treated them. Gained valuable insight! (+10 Energy)",
                    effect: { energy: 10, patients: 1 }
                },
                fail: {
                    outcome: "You contracted Diphtheria!",
                    death: "You died of Diphtheria!"
                }
            },
            {
                text: "Refer them to the nearest hospital",
                cost: {},
                roll: false,
                outcome: "Patient leaves safely. No resources gained or lost.",
                effect: {}
            }
        ]
    },
    {
        text: "You pull over at a rundown roadside motel for the night.",
        choices: [
            {
                text: "Rent a room (-10 Fuel)",
                cost: { fuel: 10 },
                roll: true,
                successRoll: 8,
                success: {
                    outcome: "The beds were surprisingly comfortable. (+20 Energy)",
                    effect: { energy: 20 }
                },
                fail: {
                    outcome: "The room was infested with bed bugs! Staff morale plummets. (-20 Energy)",
                    effect: { energy: -20 }
                }
            },
            {
                text: "Sleep in the Mobile Clinic",
                cost: {},
                roll: false,
                outcome: "A bit cramped, but safe. (+10 Energy)",
                effect: { energy: 10 }
            }
        ]
    },
    {
        text: "You spot a stranded car on the side of the road.",
        choices: [
            {
                text: "Stop to help them (-10 Energy)",
                cost: { energy: 10 },
                roll: true,
                successRoll: 11,
                success: {
                    outcome: "They were grateful and gave you extra medical supplies. (+20 Meds)",
                    effect: { supplies: 20 }
                },
                fail: {
                    outcome: "It was an ambush! Thieves stole some fuel. (-15 Fuel)",
                    effect: { fuel: -15 }
                }
            },
            {
                text: "Keep driving to save time",
                cost: {},
                roll: false,
                outcome: "You safely pass them by, preserving energy.",
                effect: {}
            }
        ]
    },
    {
        text: "You pass a sick farmer by the side of the road.",
        choices: [
            {
                text: "Treat the farmer (-5 Meds, -5 Energy)",
                cost: { supplies: 5, energy: 5 },
                roll: true,
                successRoll: 8,
                success: {
                    outcome: "The farmer was grateful and filled your tank! (+20 Fuel)",
                    effect: { fuel: 20, patients: 1 }
                },
                fail: {
                    outcome: "You couldn't do much, but they appreciated the effort.",
                    effect: { patients: 1 }
                }
            },
            {
                text: "Keep driving",
                cost: {},
                roll: false,
                outcome: "You preserved your supplies but ignored a patient.",
                effect: {}
            }
        ]
    },
    {
        text: "You stumble upon a rural emergency scene!",
        choices: [
            {
                text: "Provide emergency care (-10 Meds, -10 Energy)",
                cost: { supplies: 10, energy: 10 },
                roll: true,
                successRoll: 10,
                success: {
                    outcome: "You saved their life! The community gave you supplies. (+15 Fuel, +5 Meds)",
                    effect: { fuel: 15, supplies: 5, patients: 1 }
                },
                fail: {
                    outcome: "You did your best, but all the supplies were used up.",
                    effect: { patients: 1 }
                }
            },
            {
                text: "It's too dangerous, keep moving",
                cost: {},
                roll: false,
                outcome: "You drove past the emergency. Your conscience weighs heavy.",
                effect: { energy: -5 }
            }
        ]
    }
];

let roadOffset = 0;
let isTraveling = false;
let travelTimer = 0;

document.addEventListener('keydown', (e) => {
    if (state.gameOver || state.win) {
        if (e.key === ' ' || e.key === 'Spacebar') {
            resetGame();
        }
        return;
    }

    if (isTraveling) return; // Prevent actions while traveling animation plays

    if (state.awaitingChoice) {
        handleChoice(e.key);
        return;
    }

    if (e.key === '1') {
        travel();
    } else if (e.key === '2') {
        rest();
    } else if (e.key === '3') {
        checkInventory();
    }
});

function travel() {
    isTraveling = true;
    travelTimer = 60; // frames of animation
    
    state.fuel -= 5;
    state.energy -= 5;
    let distanceGained = Math.floor(Math.random() * 11) + 20; // 20-30 miles
    state.distance += distanceGained;
    state.day++;
    
    let eventText = `Day ${state.day}: Traveled ${distanceGained} miles.`;
    
    let eventTriggered = false;
    let interactiveTriggered = false;

    // Roll a D20 to determine the day's outcome
    const eventRoll = Math.floor(Math.random() * 20) + 1;

    if (eventRoll <= 3) {
        // 1-3: Nothing happens (15%)
        eventText += `\nNo major events today.`;
    } else if (eventRoll <= 12) {
        // 4-12: Instant event (45%)
        eventTriggered = true;
        let ev = instantEvents[Math.floor(Math.random() * instantEvents.length)];
        state.fuel += ev.fuel;
        state.supplies += ev.supplies;
        state.energy += ev.energy;
        if (ev.patients) state.patientsTreated += ev.patients;
        eventText += `\nEVENT: ${ev.text}`;
    } else {
        // 13-20: Interactive choice event (40%)
        eventTriggered = true;
        interactiveTriggered = true;
        state.awaitingChoice = true;
        state.currentEvent = interactiveEvents[Math.floor(Math.random() * interactiveEvents.length)];
        eventText += `\nEVENT: ${state.currentEvent.text}`;
    }
    
    updateLog(eventText);
    
    setTimeout(() => {
        if (interactiveTriggered) {
            showChoiceMenu();
            updateUI(); // update stats like fuel that dropped from travel
        } else {
            checkEndConditions();
            updateUI();
        }
    }, 1000); // 1000ms delay matches ~60 frames at 60fps
}

function rest() {
    state.fuel -= 2; // Generator
    state.energy += 20;
    state.day++;
    if (state.energy > 100) state.energy = 100;
    
    updateLog(`Day ${state.day}: Rested for the day.\nRecovered 20 energy.\nUsed 2 fuel for the generator.`);
    checkEndConditions();
    updateUI();
}

function checkInventory() {
    updateLog(`--- INVENTORY CHECK ---\nDistance left: ${GOAL_DISTANCE - state.distance} miles.\nFuel: ${state.fuel} gal\nMedical Supplies: ${state.supplies} units\nStaff Energy: ${state.energy}%\nPatients Cared For: ${state.patientsTreated}\nDay: ${state.day}`);
    updateUI();
}

function showChoiceMenu() {
    document.getElementById('action-menu').classList.add('hidden');
    const choiceMenu = document.getElementById('event-choice-menu');
    choiceMenu.classList.remove('hidden');
    choiceMenu.innerHTML = '';
    
    state.currentEvent.choices.forEach((choice, index) => {
        const p = document.createElement('p');
        p.innerText = `${index + 1}. ${choice.text}`;
        choiceMenu.appendChild(p);
    });
    
    document.querySelector('.prompt-text').innerHTML = `Make your choice <span class="blinking-cursor">_</span>`;
}

function hideChoiceMenu() {
    document.getElementById('event-choice-menu').classList.add('hidden');
    document.getElementById('action-menu').classList.remove('hidden');
    document.querySelector('.prompt-text').innerHTML = `Press 1, 2, or 3 <span class="blinking-cursor">_</span>`;
}

function handleChoice(key) {
    const choiceIndex = parseInt(key) - 1;
    if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= state.currentEvent.choices.length) return;
    
    const choice = state.currentEvent.choices[choiceIndex];
    
    // Check if we can afford the cost
    if (choice.cost) {
        if (choice.cost.fuel && state.fuel < choice.cost.fuel) {
            updateLog("Not enough fuel for that choice!");
            return;
        }
        if (choice.cost.supplies && state.supplies < choice.cost.supplies) {
            updateLog("Not enough medical supplies for that choice!");
            return;
        }
        if (choice.cost.energy && state.energy < choice.cost.energy) {
            updateLog("Not enough staff energy for that choice!");
            return;
        }
        // Deduct cost
        if (choice.cost.fuel) state.fuel -= choice.cost.fuel;
        if (choice.cost.supplies) state.supplies -= choice.cost.supplies;
        if (choice.cost.energy) state.energy -= choice.cost.energy;
    }
    
    let outcomeText = "";
    let deathReason = null;
    
    if (choice.roll) {
        // Roll a D20 backend
        const d20 = Math.floor(Math.random() * 20) + 1;
        
        if (d20 >= choice.successRoll) {
            outcomeText += choice.success.outcome;
            if (choice.success.effect) {
                if (choice.success.effect.fuel) state.fuel += choice.success.effect.fuel;
                if (choice.success.effect.supplies) state.supplies += choice.success.effect.supplies;
                if (choice.success.effect.energy) state.energy += choice.success.effect.energy;
                if (choice.success.effect.patients) state.patientsTreated += choice.success.effect.patients;
            }
        } else {
            outcomeText += choice.fail.outcome;
            if (choice.fail.effect) {
                if (choice.fail.effect.fuel) state.fuel += choice.fail.effect.fuel;
                if (choice.fail.effect.supplies) state.supplies += choice.fail.effect.supplies;
                if (choice.fail.effect.energy) state.energy += choice.fail.effect.energy;
                if (choice.fail.effect.patients) state.patientsTreated += choice.fail.effect.patients;
            }
            if (choice.fail.death) {
                deathReason = choice.fail.death;
            }
        }
    } else {
        outcomeText += choice.outcome;
        if (choice.effect) {
            if (choice.effect.fuel) state.fuel += choice.effect.fuel;
            if (choice.effect.supplies) state.supplies += choice.effect.supplies;
            if (choice.effect.energy) state.energy += choice.effect.energy;
            if (choice.effect.patients) state.patientsTreated += choice.effect.patients;
        }
    }
    
    updateLog(`You chose: ${choice.text}\nResult: ${outcomeText}`);
    
    state.awaitingChoice = false;
    state.currentEvent = null;
    hideChoiceMenu();
    
    if (deathReason) {
        triggerGameOver(deathReason);
    } else {
        checkEndConditions();
        updateUI();
    }
}

function updateLog(text) {
    const logEl = document.getElementById('event-log');
    logEl.innerText = text;
    const container = document.getElementById('event-log-container');
    container.scrollTop = container.scrollHeight;
}

function updateUI() {
    document.getElementById('dist-val').innerText = state.distance;
    document.getElementById('day-val').innerText = state.day;
    document.getElementById('fuel-val').innerText = state.fuel;
    document.getElementById('meds-val').innerText = state.supplies;
    document.getElementById('nrgy-val').innerText = state.energy;
    document.getElementById('patients-val').innerText = state.patientsTreated;
}

function triggerGameOver(reason) {
    updateUI();
    state.gameOver = true;
    
    let finalScore = state.distance * 5; 
    finalScore += state.patientsTreated * 1000;
    
    document.getElementById('end-reason').innerText = reason;
    document.getElementById('final-dist').innerText = state.distance;
    document.getElementById('loss-patients').innerText = state.patientsTreated;
    document.getElementById('loss-score').innerText = finalScore;
    
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function checkEndConditions() {
    if (state.distance >= GOAL_DISTANCE) {
        state.distance = GOAL_DISTANCE;
        updateUI();
        state.win = true;
        
        let finalScore = 5000 - (state.day * 50);
        finalScore += state.fuel * 10;
        finalScore += state.supplies * 20;
        finalScore += state.energy * 5;
        finalScore += state.patientsTreated * 1000;
        
        document.getElementById('win-patients').innerText = state.patientsTreated;
        document.getElementById('win-days').innerText = state.day;
        document.getElementById('win-score').innerText = finalScore;
        document.getElementById('main-screen').classList.add('hidden');
        document.getElementById('win-screen').classList.remove('hidden');
        return;
    }
    
    let reason = "";
    if (state.fuel <= 0) {
        state.fuel = 0;
        reason = "Out of fuel! You are stranded.";
    } else if (state.supplies < 0) {
        state.supplies = 0;
        reason = "Out of medical supplies!\nYou cannot treat patients.";
    } else if (state.energy <= 0) {
        state.energy = 0;
        reason = "Staff collapsed from exhaustion!";
    }

    if (reason !== "") {
        triggerGameOver(reason);
    }
}

function resetGame() {
    state = {
        distance: 0,
        fuel: 100,
        supplies: 50,
        energy: 100,
        day: 1,
        patientsTreated: 0,
        gameOver: false,
        win: false,
        awaitingChoice: false,
        currentEvent: null
    };
    
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('win-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    hideChoiceMenu();
    
    updateLog("Ready to depart.");
    updateUI();
}

// Drawing logic
function drawVan(x, y) {
    ctx.strokeStyle = '#33ff00';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#050505';
    
    ctx.fillRect(x, y, 60, 90);
    ctx.strokeRect(x, y, 60, 90);
    
    ctx.fillStyle = '#33ff00';
    ctx.fillRect(x + 20, y + 40, 20, 6);
    ctx.fillRect(x + 27, y + 33, 6, 20);
    
    ctx.strokeRect(x + 5, y + 5, 50, 20);
    
    ctx.fillStyle = '#33ff00';
    ctx.fillRect(x - 5, y + 15, 5, 20);
    ctx.fillRect(x + 60, y + 15, 5, 20);
    ctx.fillRect(x - 5, y + 60, 5, 20);
    ctx.fillRect(x + 60, y + 60, 5, 20);
    
    if (isTraveling && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.fillStyle = '#4af626';
        ctx.fillStyle = 'rgba(51, 255, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(x + 5, y);
        ctx.lineTo(x - 10, y - 50);
        ctx.lineTo(x + 20, y - 50);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(x + 45, y);
        ctx.lineTo(x + 30, y - 50);
        ctx.lineTo(x + 60, y - 50);
        ctx.fill();
        
        ctx.fillStyle = '#4af626';
    } else {
        ctx.fillStyle = '#1a8000';
    }
    ctx.fillRect(x + 5, y - 5, 10, 5);
    ctx.fillRect(x + 45, y - 5, 10, 5);
}

function drawRoad() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#1a8000';
    ctx.fillRect(50, 0, 4, canvas.height);
    ctx.fillRect(canvas.width - 54, 0, 4, canvas.height);
    
    ctx.fillStyle = '#33ff00';
    for (let i = -100; i < canvas.height; i += 60) {
        ctx.fillRect(canvas.width / 2 - 2, i + roadOffset, 4, 30);
    }
}

function gameLoop() {
    if (isTraveling) {
        roadOffset += 8;
        if (roadOffset >= 60) {
            roadOffset -= 60;
        }
        travelTimer--;
        if (travelTimer <= 0) {
            isTraveling = false;
        }
    }
    
    drawRoad();
    drawVan(canvas.width / 2 - 30, canvas.height - 150);
    
    requestAnimationFrame(gameLoop);
}

// Initial setup
updateUI();
requestAnimationFrame(gameLoop);
