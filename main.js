var bird;
// bird gravity, will make bird fall if you don't flap
var birdGravity = 400; //800
// horizontal bird speed
var birdSpeed = 125;
// flap thrust
var birdFlapPower = 200; //300
// milliseconds between the creation of two pipes
var pipeInterval = 3000;
// hole between pipes, in pixels
var pipeHole = 120;
var pipeGroup;
var score = 0;
var scoreText;
var topScore;
var button;

var audioContext = null;
var meter = null;
var WIDTH = 500;
var HEIGHT = 50;
var rafID = null;
var gameOver = false;

var topScorers = [];
var topScorersText;

var lightningElements = [];
var lastLightningScore = 0;

window.onload = function() {	
    //======microphone setup
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();

    try {
        navigator.getUserMedia = 
            navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia;

        navigator.getUserMedia(
            {
                "audio": {
                    "mandatory": {
                        "googEchoCancellation": "false",
                        "googAutoGainControl": "false",
                        "googNoiseSuppression": "false",
                        "googHighpassFilter": "false"
                    },
                    "optional": []
                },
            }, gotStream, didntGetStream);
    } catch (e) {
        alert('getUser Media threw exception :' + e);
    }

    //======game setup
    var game = new Phaser.Game(1300, 800, Phaser.CANVAS);

    var play = function(game) {}

    var hasShaken = false;

    play.prototype = {
        preload: function() {
            game.load.image("bird", "assets/bird-2.png");
            game.load.image("pipe", "assets/pipe1.png");
            game.load.image("button", "assets/start-1.png");	
            game.load.image("bg", "assets/game-bg2.png");
            game.load.image("trail", "assets/trail.png");

            // Add game over image
            game.load.image("gameOver", "assets/game-over.png");
            game.load.image("restartButton", "assets/retry.png");

            // Load sound files
            game.load.audio('startSound', 'assets/Sounds/game-start.mp3');
            // game.load.audio('gameOverSound', 'assets/Sounds/game-over.mp3');
            game.load.audio('gameScoreSound', 'assets/Sounds/scoring.mp3');
        },

        create: function() {
            game.paused = true;
            // Use scale method to make the background fit the entire canvas
            var background = game.add.sprite(0, 0, 'bg');
            background.width = game.width;
            background.height = game.height;

            button = game.add.button(game.world.centerX - 95, 630, 'button', actionOnClick, this, 2, 1, 0);   

            pipeGroup = game.add.group();
            score = 0;
            topScore = localStorage.getItem("topFlappyScore") == null ? 0 : localStorage.getItem("topFlappyScore");
            scoreText = game.add.text(10, 10, "-", {
                font: "bold 32px Arial",
                fill: "#5ed2fd"  
            });

            updateScore();
            game.stage.backgroundColor = "#87CEEB";
            game.stage.disableVisibilityChange = true;
            game.physics.startSystem(Phaser.Physics.ARCADE);
            bird = game.add.sprite(80, 240, "bird");
            bird.anchor.set(0.5);
            game.physics.arcade.enable(bird);
            bird.body.gravity.y = birdGravity;

            game.time.events.loop(pipeInterval, addPipe);
            addPipe();

            // Load top scorers from localStorage
            loadTopScorers();

            // Create text for top scorers
            topScorersText = game.add.text(game.width - 200, 10, "Top High Scorers", {
                font: "bold 24px Arial",
                fill: "#5ed2fd"
            });
            updateTopScorersDisplay();
            // Create sound objects
            this.startSound = game.add.audio('startSound');
            // this.gameOverSound = game.add.audio('gameOverSound');
            this.scoreSound = game.add.audio('gameScoreSound');

            // Spacebar keyboard input
            this.spaceKey = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
            this.spaceKey.onDown.add(() => {
                if (!gameOver && bird && bird.body) {
                    bird.body.velocity.y = -birdFlapPower * 1.5; // Increase flap power
                }
            }, this);

            // Create the trail sprite for an after-image effect
            this.trail = game.add.emitter(bird.x - 50, bird.y, 50); // Position it to the left of the bird
            this.trail.makeParticles('trail'); 
            this.trail.setYSpeed(-20, 20); 
            this.trail.setXSpeed(-20, 20); 
            this.trail.setAlpha(1, 0, 1000); 
            this.trail.setScale(0.5, 0, 0.5, 0, 1000); 
            this.trail.start(false, 1000, 50); // Start emitting particles
            },

            update: function() {
                // Only allow game mechanics if game is not over
                if (!gameOver) {
                    game.physics.arcade.collide(bird, pipeGroup, die);
                    if (bird.y > game.height) {
                        die();
                    }
            
                    // Update trail position to follow the bird
                    this.trail.x = bird.x - 40; // Keep it a little left of the bird
                    this.trail.y = bird.y; // Align with the bird's y position
            
                    // Check for score to trigger shake
                    if (score >= 20 && !hasShaken) {
                        game.camera.shake(0.05, 500); // Shake for 500 milliseconds with intensity of 0.05
                        hasShaken = true; // Set the flag to true to prevent further shakes
                    }
            
                    // Lightning logic
                    if (score > 0 && score % 10 === 0 && score !== lastLightningScore) {
                        triggerLightning(game);
                        lastLightningScore = score;
                    }
                }
            },
    
        // Add a method to stop the game completely
        stopGame: function() {
            gameOver = true;
            // Stop pipe generation
            game.time.events.removeAll();
            // Stop bird movement
            bird.body.velocity.x = 0;
            bird.body.velocity.y = 0;
            bird.body.gravity.y = 0;
            // Stop pipes
            pipeGroup.forEach(function(pipe) {
                pipe.body.velocity.x = 0;
            }, this);
        }
    }
     
    game.state.add("Play", play);
    game.state.start("Play");
     
    function updateScore() {
        scoreText.text = "Score: " + score + "\nBest: " + topScore;	
    }

    function loadTopScorers() {
        var storedScorers = localStorage.getItem("topFlappyScorers");
        topScorers = storedScorers ? JSON.parse(storedScorers) : [];
    }

    function updateTopScorersDisplay() {
        var displayText = "Top High Scorers\n";
        topScorers.sort((a, b) => b.score - a.score);
        
        for (var i = 0; i < Math.min(5, topScorers.length); i++) {
            displayText += `${i + 1}. ${topScorers[i].name}: ${topScorers[i].score}\n`;
        }
        
        topScorersText.text = displayText;
    }
    
    function checkAndAddHighScore(newScore) {
        var playerName = prompt("Enter your name:");
        
        if (playerName) {
            // If the list is not full or the new score is higher than the lowest score
            if (topScorers.length < 5 || newScore > topScorers[topScorers.length - 1].score) {
                if (topScorers.length >= 5) {
                    topScorers.pop(); // Remove the lowest score
                }
                
                topScorers.push({ name: playerName, score: newScore });
                
                // Sort and save
                topScorers.sort((a, b) => b.score - a.score);
                localStorage.setItem("topFlappyScorers", JSON.stringify(topScorers));
                
                updateTopScorersDisplay();
            }
        }
    }

    function triggerLightning(game) {
        // Remove previous lightning elements
        lightningElements.forEach(element => element.remove());
        lightningElements = [];
    
        // Strike 3 times
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                let lightning = createLightningElement(game);
                lightningElements.push(lightning);
            }, i * 500); // Stagger lightning strikes
        }
    }
    
    function createLightningElement(game) {
        // Create a lightning div
        let lightning = document.createElement('div');
        lightning.style.position = 'absolute';
        lightning.style.top = '0';
        lightning.style.left = '0';
        lightning.style.width = '100%';
        lightning.style.height = '100%';
        lightning.style.pointerEvents = 'none';
        lightning.style.zIndex = '1000';
        
        // Create lightning effect
        lightning.style.background = `
            repeating-linear-gradient(
                0deg,
                rgba(255, 255, 255, 0.1),
                rgba(255, 255, 255, 0.1) 1px,
                transparent 1px,
                transparent 2px
            ),
            linear-gradient(
                ${Math.random() * 360}deg, 
                rgba(173, 216, 230, 0.3), 
                rgba(135, 206, 235, 0.5)
            )
        `;
        
        // Random lightning bolt
        let bolt = document.createElement('div');
        bolt.style.position = 'absolute';
        bolt.style.width = '10px';
        bolt.style.height = '100%';
        bolt.style.left = `${Math.random() * 100}%`;
        bolt.style.background = 'linear-gradient(to bottom, transparent, white, transparent)';
        bolt.style.opacity = '0.7';
        bolt.style.animation = 'lightning 0.1s linear infinite';
        
        lightning.appendChild(bolt);
        
        // Add style for lightning animation
        let style = document.createElement('style');
        style.textContent = `
            @keyframes lightning {
                0% { box-shadow: 0 0 5px white; }
                50% { box-shadow: 0 0 20px white; }
                100% { box-shadow: 0 0 5px white; }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(lightning);
        
        // Automatically remove lightning after a short duration
        setTimeout(() => {
            document.body.removeChild(lightning);
            document.head.removeChild(style);
        }, 1000);
        
        return lightning;
    }

    var pipeCounter = 0; // Global variable to track pipe generation

    function addPipe() {
        let currentPipeSpeed = -birdSpeed - (Math.floor(score / 5) * 2);
        let currentBirdGravity = birdGravity + (Math.floor(score / 10) * 20);

        // First two pipes (initial generation)
        if (pipeCounter === 0) {
            var pipeHolePosition = game.rnd.between(600, 200 - pipeHole);
            var upperPipe = new Pipe(game, 400, pipeHolePosition - 620, currentPipeSpeed);
            game.add.existing(upperPipe);
            pipeGroup.add(upperPipe);
            var lowerPipe = new Pipe(game, 400, pipeHolePosition + pipeHole + 50, currentPipeSpeed);
            game.add.existing(lowerPipe);
            pipeGroup.add(lowerPipe);
            
            pipeCounter++;
        } 
        // After first two pipes, generate 4 pipes
        else if (pipeCounter === 1) {
            // First pair of pipes
            var pipeHolePosition1 = game.rnd.between(600, 200 - pipeHole);
            var upperPipe1 = new Pipe(game, 500, pipeHolePosition1 - 620, currentPipeSpeed);
            game.add.existing(upperPipe1);
            pipeGroup.add(upperPipe1);
            var lowerPipe1 = new Pipe(game, 500, pipeHolePosition1 + pipeHole + 50, currentPipeSpeed);
            game.add.existing(lowerPipe1);
            pipeGroup.add(lowerPipe1);

            // Second pair of pipes
            var pipeHolePosition2 = game.rnd.between(600, 200 - pipeHole);
            var upperPipe2 = new Pipe(game, 950, pipeHolePosition2 - 620, currentPipeSpeed);
            game.add.existing(upperPipe2);
            pipeGroup.add(upperPipe2);
            var lowerPipe2 = new Pipe(game, 950, pipeHolePosition2 + pipeHole + 50, currentPipeSpeed);
            game.add.existing(lowerPipe2);
            pipeGroup.add(lowerPipe2);

            pipeCounter++;
        }
        // Continue generating 2 pipes in subsequent calls
        else {
            var pipeHolePosition = game.rnd.between(600, 200 - pipeHole);
            var upperPipe = new Pipe(game, 1050 + (pipeCounter - 2) * 800, pipeHolePosition - 620, currentPipeSpeed);
            game.add.existing(upperPipe);
            pipeGroup.add(upperPipe);
            var lowerPipe = new Pipe(game, 1050 + (pipeCounter - 2) * 800, pipeHolePosition + pipeHole + 50, currentPipeSpeed);
            game.add.existing(lowerPipe);
            pipeGroup.add(lowerPipe);
        }

        // Adjust the bird's gravity based on score
        bird.body.gravity.y = currentBirdGravity;
    }
	
    function die() {
        if (gameOver) return;
        
        gameOver = true;
        
        // Play game over sound
        // this.gameOverSound.play();
        
        var currentTopScore = Math.max(score, topScore);
        localStorage.setItem("topFlappyScore", currentTopScore);
        
        // Check if this is a high score
        checkAndAddHighScore(score);
        
        // Call the stopGame method
        game.state.getCurrentState().stopGame();
        
        // Add game over image
        var gameOverImage = game.add.sprite(game.world.centerX, game.world.centerY, 'gameOver');
        gameOverImage.anchor.set(0.5);
        
        // Add restart button
        var restartButton = game.add.button(
            game.world.centerX, 
            game.world.centerY + 100, 
            'restartButton', 
            restartGame, 
            this, 2, 1, 0
        );
        restartButton.anchor.set(0.5);
    }

    
    function restartGame() {
        location.reload();
    }
	
    Pipe = function (game, x, y, speed) {
        Phaser.Sprite.call(this, game, x, y, "pipe");
        game.physics.enable(this, Phaser.Physics.ARCADE);
        this.body.velocity.x = speed;
        this.giveScore = true;	
    };
	
    Pipe.prototype = Object.create(Phaser.Sprite.prototype);
    Pipe.prototype.constructor = Pipe;
	
    Pipe.prototype.update = function() {
        if (this.x + this.width < bird.x && this.giveScore) {
            score += 0.5;
            updateScore();
            
            // Play scoring sound
            if (score % 1 === 0) {  // Only play sound on whole number scores
                this.game.state.getCurrentState().scoreSound.play();
            }
            
            this.giveScore = false;
        }
        if (this.x < -this.width) {
            this.destroy();
        }
    };	

    function actionOnClick() {
        console.log("GOT CLICKED FAM!");
        
        // Play start sound
        this.startSound.play();
        
        audioContext.resume();
        sleep(1000).then(() => {
            //do stuff
        });
        game.paused = false;
        button.visible = false;
    }
}

function flap() {
    if (!gameOver && bird && bird.body) {
        bird.body.velocity.y = -birdFlapPower;
    }
}

function didntGetStream() {
    alert('Stream generation failed.');
}

var mediaStreamSource = null;

function gotStream(stream) {
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    meter = createAudioMeter(audioContext);
    mediaStreamSource.connect(meter);
    drawLoop();
}

function drawLoop(time) {
    if (!gameOver && meter && meter.volume * 100 > 10) {
        console.log("Flapping! Volume:", meter.volume * 100);
        flap();
    }
    rafID = window.requestAnimationFrame(drawLoop);
}

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}



