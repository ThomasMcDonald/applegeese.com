const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 150; // Account for UI panel
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game state
const gameObjects = [];
let selectedGeese = [];
let destination = null;
let breadcrumbs = 0;

// World and Camera
const world = { width: 3000, height: 3000 };
const camera = { x: 0, y: 0, zoom: 1 };

// Pathfinding Grid
class Grid {
    constructor(width, height, nodeSize) {
        this.width = width;
        this.height = height;
        this.nodeSize = nodeSize;
        this.grid = [];
        this.cols = Math.ceil(width / nodeSize);
        this.rows = Math.ceil(height / nodeSize);

        for (let x = 0; x < this.cols; x++) {
            this.grid[x] = [];
            for (let y = 0; y < this.rows; y++) {
                this.grid[x][y] = { x, y, walkable: true };
            }
        }
    }

    updateObstacles(gameObjects) {
        // Reset grid
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                this.grid[x][y].walkable = true;
            }
        }

        // Mark obstacles
        gameObjects.forEach(obj => {
            if (obj.type === 'nest' || obj.type === 'barracks' || obj.type === 'breadcrumb') {
                const startX = Math.floor((obj.x - obj.size) / this.nodeSize);
                const startY = Math.floor((obj.y - obj.size) / this.nodeSize);
                const endX = Math.ceil((obj.x + obj.size) / this.nodeSize);
                const endY = Math.ceil((obj.y + obj.size) / this.nodeSize);

                for (let x = startX; x < endX; x++) {
                    for (let y = startY; y < endY; y++) {
                        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                            this.grid[x][y].walkable = false;
                        }
                    }
                }
            }
        });
    }

    getNode(x, y) {
        const gridX = Math.floor(x / this.nodeSize);
        const gridY = Math.floor(y / this.nodeSize);
        if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
            return this.grid[gridX][gridY];
        }
        return null;
    }
}

// A* Pathfinding
class AStar {
    constructor(grid) {
        this.grid = grid;
    }

    findPath(startX, startY, endX, endY) {
        const startNode = this.grid.getNode(startX, startY);
        const endNode = this.grid.getNode(endX, endY);

        if (!startNode || !endNode || !startNode.walkable || !endNode.walkable) {
            return null;
        }

        const openList = [];
        const closedList = [];
        openList.push(startNode);

        startNode.g = 0;
        startNode.h = this.heuristic(startNode, endNode);
        startNode.f = startNode.g + startNode.h;
        startNode.parent = null;

        while (openList.length > 0) {
            // Find the node with the lowest f value in the open list
            let lowestIndex = 0;
            for (let i = 0; i < openList.length; i++) {
                if (openList[i].f < openList[lowestIndex].f) {
                    lowestIndex = i;
                }
            }
            const currentNode = openList[lowestIndex];

            // Move the current node from the open list to the closed list
            openList.splice(lowestIndex, 1);
            closedList.push(currentNode);

            // If we've reached the end, retrace the path
            if (currentNode === endNode) {
                const path = [];
                let curr = currentNode;
                while (curr) {
                    path.push({ x: (curr.x * this.grid.nodeSize) + this.grid.nodeSize / 2, y: (curr.y * this.grid.nodeSize) + this.grid.nodeSize / 2 });
                    curr = curr.parent;
                }
                return path.reverse();
            }

            // Get neighbors
            const neighbors = this.getNeighbors(currentNode);
            for (const neighbor of neighbors) {
                if (closedList.includes(neighbor) || !neighbor.walkable) {
                    continue;
                }

                const gScore = currentNode.g + 1; // Assuming cost of 1 to move to a neighbor
                let gScoreIsBest = false;

                if (!openList.includes(neighbor)) {
                    gScoreIsBest = true;
                    neighbor.h = this.heuristic(neighbor, endNode);
                    openList.push(neighbor);
                } else if (gScore < neighbor.g) {
                    gScoreIsBest = true;
                }

                if (gScoreIsBest) {
                    neighbor.parent = currentNode;
                    neighbor.g = gScore;
                    neighbor.f = neighbor.g + neighbor.h;
                }
            }
        }

        return null; // No path found
    }

    heuristic(a, b) {
        // Manhattan distance
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    getNeighbors(node) {
        const neighbors = [];
        const x = node.x;
        const y = node.y;

        // Cardinal directions
        if (this.grid.grid[x - 1] && this.grid.grid[x - 1][y]) neighbors.push(this.grid.grid[x - 1][y]);
        if (this.grid.grid[x + 1] && this.grid.grid[x + 1][y]) neighbors.push(this.grid.grid[x + 1][y]);
        if (this.grid.grid[x] && this.grid.grid[x][y - 1]) neighbors.push(this.grid.grid[x][y - 1]);
        if (this.grid.grid[x] && this.grid.grid[x][y + 1]) neighbors.push(this.grid.grid[x][y + 1]);

        return neighbors;
    }
}


function screenToWorld(x, y) {
    const worldX = (x - canvas.width / 2) / camera.zoom + camera.x;
    const worldY = (y - canvas.height / 2) / camera.zoom + camera.y;
    return { x: worldX, y: worldY };
}


// Breadcrumb class
class Breadcrumb {
    constructor(x, y) {
        this.type = 'breadcrumb';
        this.x = x;
        this.y = y;
        this.size = 10;
        this.amount = 100; // Amount of resource
    }

    draw() {
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        // Resources don't do anything on their own
    }
}

function drawHealthbar(x, y, size, health, maxHealth) {
    if (health < maxHealth) {
        const barWidth = size * 1.5;
        const barHeight = 5;
        const xOffset = -barWidth / 2;
        const yOffset = -size - 10;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(x + xOffset, y + yOffset, barWidth, barHeight);
        
        const healthPercentage = health / maxHealth;
        ctx.fillStyle = healthPercentage > 0.5 ? 'green' : (healthPercentage > 0.2 ? 'orange' : 'red');
        ctx.fillRect(x + xOffset, y + yOffset, barWidth * healthPercentage, barHeight);
    }
}

// Goose class
class Goose {
    constructor(x, y, faction = 'player') {
        this.type = 'goose';
        this.faction = faction;
        this.x = x;
        this.y = y;
        this.size = 20;
        this.speed = 2;
        this.target = null;
        this.gatheringTarget = null;
        this.attackTarget = null;
        this.breadcrumbsCarried = 0;
        this.maxBreadcrumbs = 10;
        this.state = 'idle'; // idle, moving, gathering, returning, attacking
        this.direction = { x: 0, y: 0 };
        this.path = [];

        // Combat stats
        this.health = 100;
        this.maxHealth = 100;
        this.attackDamage = 10;
        this.attackRange = 40; // Increased range
        this.attackCooldown = 1000; // ms
        this.lastAttackTime = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Rotate goose to face its direction
        if (this.direction.x !== 0 || this.direction.y !== 0) {
            ctx.rotate(Math.atan2(this.direction.y, this.direction.x) + Math.PI / 2);
        }

        // Simple goose shape
        ctx.fillStyle = selectedGeese.includes(this) ? 'yellow' : 'white';
        ctx.beginPath();
        ctx.moveTo(0, -this.size); // Head
        ctx.lineTo(-this.size / 2, 0); // Left wing
        ctx.lineTo(0, this.size / 2); // Tail
        ctx.lineTo(this.size / 2, 0); // Right wing
        ctx.closePath();
        ctx.fill();

        // Beak
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.moveTo(0, -this.size - 2);
        ctx.lineTo(-3, -this.size + 5);
        ctx.lineTo(3, -this.size + 5);
        ctx.closePath();
        ctx.fill();
        
        // Draw breadcrumb carried indicator
        if (this.breadcrumbsCarried > 0) {
            const indicatorSize = (this.breadcrumbsCarried / this.maxBreadcrumbs) * (this.size / 2);
            ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(0, 0, indicatorSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Draw health bar in world space
        drawHealthbar(this.x, this.y, this.size, this.health, this.maxHealth);
    }

    findClosestNest() {
        let closestNest = null;
        let minDistance = Infinity;

        gameObjects.forEach(obj => {
            if (obj.type === 'nest') {
                const distance = Math.hypot(this.x - obj.x, this.y - obj.y);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestNest = obj;
                }
            }
        });
        return closestNest;
    }

    getAvoidanceVector() {
        const avoidanceVector = { x: 0, y: 0 };
        let neighborCount = 0;

        gameObjects.forEach(obj => {
            if (obj.type === 'goose' && obj !== this) {
                const distance = Math.hypot(this.x - obj.x, this.y - obj.y);
                if (distance < this.size * 2) { // Detection radius
                    neighborCount++;
                    avoidanceVector.x += (this.x - obj.x);
                    avoidanceVector.y += (this.y - obj.y);
                }
            }
        });

        if (neighborCount > 0) {
            avoidanceVector.x /= neighborCount;
            avoidanceVector.y /= neighborCount;
            const magnitude = Math.hypot(avoidanceVector.x, avoidanceVector.y);
            if (magnitude > 0) {
                avoidanceVector.x /= magnitude;
                avoidanceVector.y /= magnitude;
            }
        }

        return avoidanceVector;
    }

    getObstacleAvoidanceVector() {
        const avoidanceVector = { x: 0, y: 0 };
        let closeObstacles = 0;

        gameObjects.forEach(obj => {
            if (obj !== this && (obj.type === 'nest' || obj.type === 'barracks' || obj.type === 'breadcrumb')) {
                const distance = Math.hypot(this.x - obj.x, this.y - obj.y);
                const collisionDistance = this.size + obj.size;
                if (distance < collisionDistance + 20) { // Check slightly beyond collision
                    closeObstacles++;
                    let awayX = this.x - obj.x;
                    let awayY = this.y - obj.y;
                    const magnitude = Math.hypot(awayX, awayY);
                    if (magnitude > 0) {
                        awayX /= magnitude;
                        awayY /= magnitude;
                    }
                    avoidanceVector.x += awayX;
                    avoidanceVector.y += awayY;
                }
            }
        });

        if (closeObstacles > 0) {
            avoidanceVector.x /= closeObstacles;
            avoidanceVector.y /= closeObstacles;
            const magnitude = Math.hypot(avoidanceVector.x, avoidanceVector.y);
            if (magnitude > 0) {
                avoidanceVector.x /= magnitude;
                avoidanceVector.y /= magnitude;
            }
        }

        return avoidanceVector;
    }


    update() {
        // Path following
        if (this.path.length > 0) {
            const targetNode = this.path[0];
            const dx = targetNode.x - this.x;
            const dy = targetNode.y - this.y;
            const distance = Math.hypot(dx, dy);

            if (distance < 5) {
                this.path.shift();
            } else {
                const targetDirection = { x: dx / distance, y: dy / distance };
                const unitAvoidance = this.getAvoidanceVector();

                let finalDirectionX = targetDirection.x + unitAvoidance.x * 0.5;
                let finalDirectionY = targetDirection.y + unitAvoidance.y * 0.5;

                const magnitude = Math.hypot(finalDirectionX, finalDirectionY);
                if (magnitude > 0) {
                    finalDirectionX /= magnitude;
                    finalDirectionY /= magnitude;
                }
                
                this.direction = { x: finalDirectionX, y: finalDirectionY };
                this.x += this.direction.x * this.speed;
                this.y += this.direction.y * this.speed;
            }
        } else {
            // No path, do state-specific logic
            switch (this.state) {
                case 'gathering':
                    if (this.gatheringTarget && gameObjects.includes(this.gatheringTarget)) {
                        const distance = Math.hypot(this.x - this.gatheringTarget.x, this.y - this.gatheringTarget.y);
                        if (distance < this.size) {
                            if (this.gatheringTarget.amount > 0 && this.breadcrumbsCarried < this.maxBreadcrumbs) {
                                this.gatheringTarget.amount--;
                                this.breadcrumbsCarried++;
                            } else if (this.breadcrumbsCarried >= this.maxBreadcrumbs) {
                                this.state = 'returning';
                                const closestNest = this.findClosestNest();
                                if (closestNest) {
                                    const path = astar.findPath(this.x, this.y, closestNest.x, closestNest.y);
                                    if (path) this.path = path;
                                }
                            } else {
                                this.gatheringTarget = null;
                                this.state = 'idle';
                            }
                        }
                    } else {
                        this.state = 'idle';
                        this.gatheringTarget = null;
                    }
                    break;
                case 'returning':
                     const closestNest = this.findClosestNest();
                     if(closestNest){
                        const distance = Math.hypot(this.x - closestNest.x, this.y - closestNest.y);
                        if (distance < this.size) {
                            breadcrumbs += this.breadcrumbsCarried;
                            this.breadcrumbsCarried = 0;
                            if (this.gatheringTarget && this.gatheringTarget.amount > 0) {
                                this.state = 'gathering';
                                const path = astar.findPath(this.x, this.y, this.gatheringTarget.x, this.gatheringTarget.y);
                                if (path) this.path = path;
                            } else {
                                this.gatheringTarget = null;
                                this.state = 'idle';
                            }
                        }
                     }
                    break;
                case 'attacking':
                    if (this.attackTarget && this.attackTarget.health > 0) {
                        const distance = Math.hypot(this.x - this.attackTarget.x, this.y - this.attackTarget.y);
                        if (distance < this.attackRange) {
                            const now = Date.now();
                            if (now - this.lastAttackTime > this.attackCooldown) {
                                this.lastAttackTime = now;
                                this.attackTarget.health -= this.attackDamage;
                            }
                        } else {
                            // Target moved, recalculate path
                             const path = astar.findPath(this.x, this.y, this.attackTarget.x, this.attackTarget.y);
                             if (path) this.path = path;
                        }
                    } else {
                        this.attackTarget = null;
                        this.state = 'idle';
                    }
                    break;
                case 'moving':
                case 'idle':
                    this.state = 'idle';
                    break;
            }
        }
    }
}

// Building classes
class Nest {
    constructor(x, y, faction = 'player') {
        this.type = 'nest';
        this.faction = faction;
        this.x = x;
        this.y = y;
        this.size = 50;
        this.health = 500;
        this.maxHealth = 500;
    }

    draw() {
        ctx.fillStyle = '#654321'; // Darker brown
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#8B4513'; // SaddleBrown
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size - 5, 0, Math.PI * 2);
        ctx.stroke();

        if (selectedBuilding === this) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        drawHealthbar(this.x, this.y, this.size, this.health, this.maxHealth);
    }

    update() {}
}

class Barracks {
    constructor(x, y, faction = 'player') {
        this.type = 'barracks';
        this.faction = faction;
        this.x = x;
        this.y = y;
        this.size = 40;
        this.health = 300;
        this.maxHealth = 300;
    }

    draw() {
        // Base
        ctx.fillStyle = '#A9A9A9'; // DarkGray
        ctx.fillRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);

        // Roof
        ctx.fillStyle = '#8B4513'; // SaddleBrown
        ctx.beginPath();
        ctx.moveTo(this.x - this.size - 10, this.y - this.size);
        ctx.lineTo(this.x + this.size + 10, this.y - this.size);
        ctx.lineTo(this.x, this.y - this.size - 20);
        ctx.closePath();
        ctx.fill();

        if (selectedBuilding === this) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        }

        drawHealthbar(this.x, this.y, this.size, this.health, this.maxHealth);
    }

    update() {}
}

// --- Object Creation ---
const grid = new Grid(world.width, world.height, 40);
const astar = new AStar(grid);

const nest = new Nest(world.width / 2, world.height / 2);
camera.x = nest.x;
camera.y = nest.y;

const goose1 = new Goose(nest.x - 50, nest.y + 50);
const goose2 = new Goose(nest.x + 50, nest.y + 50);
const goose3 = new Goose(nest.x, nest.y + 100);

const breadcrumb1 = new Breadcrumb(nest.x + 200, nest.y + 200);
const breadcrumb2 = new Breadcrumb(nest.x - 200, nest.y - 200);
const breadcrumb3 = new Breadcrumb(nest.x + 150, nest.y - 300);

// Enemy units
const enemyGoose1 = new Goose(nest.x + 400, nest.y + 400, 'enemy');
const enemyGoose2 = new Goose(nest.x - 400, nest.y - 400, 'enemy');
enemyGoose1.state = 'attacking';
enemyGoose1.attackTarget = nest;
enemyGoose2.state = 'attacking';
enemyGoose2.attackTarget = nest;

gameObjects.push(nest, goose1, goose2, goose3, breadcrumb1, breadcrumb2, breadcrumb3, enemyGoose1, enemyGoose2);

// Input variables
let isDragging = false;
let startDragPos = { x: 0, y: 0 };
let endDragPos = { x: 0, y: 0 };
let buildMode = false;
let selectedBuilding = null;
let isPanning = false;
let lastMousePos = { x: 0, y: 0 };

function calculateFormation(centerX, centerY, count) {
    const formation = [];
    const spacing = 40;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = centerX + (col - (cols - 1) / 2) * spacing;
        const y = centerY + (row - (rows - 1) / 2) * spacing;
        formation.push({ x, y });
    }
    return formation;
}

const buildBarracksButton = document.getElementById('build-barracks');
buildBarracksButton.addEventListener('click', () => {
    if (breadcrumbs >= 100) {
        buildMode = true;
        canvas.style.cursor = 'crosshair';
    }
});

const createGooseButton = document.getElementById('create-goose');
createGooseButton.addEventListener('click', () => {
    if (selectedBuilding && selectedBuilding.type === 'barracks' && breadcrumbs >= 50) {
        breadcrumbs -= 50;
        const goose = new Goose(selectedBuilding.x, selectedBuilding.y + selectedBuilding.size + 20);
        gameObjects.push(goose);
    }
});

const selectionInfo = document.getElementById('selection-info');

function updateUI() {
    if (selectedBuilding) {
        selectionInfo.innerHTML = `<h3>${selectedBuilding.type}</h3>`;
        if (selectedBuilding.type === 'barracks') {
            createGooseButton.style.display = 'block';
        } else {
            createGooseButton.style.display = 'none';
        }
        buildBarracksButton.style.display = 'none';
    } else if (selectedGeese.length > 0) {
        selectionInfo.innerHTML = `<h3>${selectedGeese.length} Geese Selected</h3>`;
        createGooseButton.style.display = 'none';
        buildBarracksButton.style.display = 'block';
    } else {
        selectionInfo.innerHTML = 'Select a unit or building';
        createGooseButton.style.display = 'none';
        buildBarracksButton.style.display = 'block';
    }
}

// --- Input Handlers ---

function handlePointerStart(screenX, screenY, isRightClick = false) {
    const worldPos = screenToWorld(screenX, screenY);

    if (buildMode) {
        if (breadcrumbs >= 100) {
            breadcrumbs -= 100;
            const barracks = new Barracks(worldPos.x, worldPos.y);
            gameObjects.push(barracks);
        }
        buildMode = false;
        canvas.style.cursor = 'default';
        return;
    }
    
    if (isRightClick) {
        isPanning = true;
        lastMousePos = { x: screenX, y: screenY };
    } else {
        isDragging = true;
        startDragPos = { x: screenX, y: screenY };
        endDragPos = { x: screenX, y: screenY };
    }

    let clickedObject = null;
    // Reverse loop to prioritize clicking objects drawn on top
    for (let i = gameObjects.length - 1; i >= 0; i--) {
        const obj = gameObjects[i];
        const distance = Math.sqrt(Math.pow(obj.x - worldPos.x, 2) + Math.pow(obj.y - worldPos.y, 2));
        if (distance < obj.size) {
            clickedObject = obj;
            break; 
        }
    }

    if (!isRightClick) {
        if (clickedObject) {
            if (clickedObject.type === 'goose') {
                selectedGeese = [clickedObject];
                selectedBuilding = null;
                destination = null;
            } else if (clickedObject.type === 'nest' || clickedObject.type === 'barracks') {
                selectedBuilding = clickedObject;
                selectedGeese = [];
            }
        } else {
            selectedGeese = [];
            selectedBuilding = null;
            destination = null;
        }
        updateUI();
    }
}

function handlePointerMove(screenX, screenY) {
    if (isPanning) {
        const dx = (screenX - lastMousePos.x) / camera.zoom;
        const dy = (screenY - lastMousePos.y) / camera.zoom;
        camera.x -= dx;
        camera.y -= dy;
        lastMousePos = { x: screenX, y: screenY };
    }

    if (isDragging) {
        endDragPos = { x: screenX, y: screenY };
    }
}

function handlePointerEnd(screenX, screenY, isRightClick = false) {
    if (isRightClick) {
        // If not dragging significantly, it's a command click
        const dragDistance = Math.hypot(screenX - startDragPos.x, screenY - startDragPos.y);
        if (dragDistance < 5) {
            issueCommand(screenX, screenY);
        }
    }

    if (isDragging) {
        const selectionRect = {
            x: Math.min(startDragPos.x, endDragPos.x),
            y: Math.min(startDragPos.y, endDragPos.y),
            width: Math.abs(startDragPos.x - endDragPos.x),
            height: Math.abs(startDragPos.y - endDragPos.y)
        };
        
        if (selectionRect.width > 10 || selectionRect.height > 10) {
            selectedGeese = [];
            gameObjects.forEach(obj => {
                if (obj.type === 'goose') {
                    const screenX = (obj.x - camera.x) * camera.zoom + canvas.width / 2;
                    const screenY = (obj.y - camera.y) * camera.zoom + canvas.height / 2;

                    if (screenX > selectionRect.x && screenX < selectionRect.x + selectionRect.width &&
                        screenY > selectionRect.y && screenY < selectionRect.y + selectionRect.height) {
                        selectedGeese.push(obj);
                    }
                }
            });
            updateUI();
        }
    }
    
    isDragging = false;
    isPanning = false;
}

function handleZoom(event) {
    event.preventDefault();
    const zoomAmount = 0.1;
    const worldPosBeforeZoom = screenToWorld(event.clientX, event.clientY);

    if (event.deltaY < 0) {
        camera.zoom = Math.min(camera.zoom + zoomAmount, 2); // Zoom in, max zoom 2x
    } else {
        camera.zoom = Math.max(camera.zoom - zoomAmount, 0.5); // Zoom out, min zoom 0.5x
    }
    
    const worldPosAfterZoom = screenToWorld(event.clientX, event.clientY);
    camera.x += (worldPosBeforeZoom.x - worldPosAfterZoom.x);
    camera.y += (worldPosBeforeZoom.y - worldPosAfterZoom.y);
}

function issueCommand(screenX, screenY) {
    if (selectedGeese.length === 0) return;
    
    const worldPos = screenToWorld(screenX, screenY);

    let clickedObject = null;
    gameObjects.forEach(obj => {
        const distance = Math.sqrt(Math.pow(obj.x - worldPos.x, 2) + Math.pow(obj.y - worldPos.y, 2));
        if (distance < obj.size + 10) {
            clickedObject = obj;
        }
    });

    if (clickedObject && clickedObject.type === 'breadcrumb') {
        selectedGeese.forEach(goose => {
            const path = astar.findPath(goose.x, goose.y, clickedObject.x, clickedObject.y);
            if (path) {
                goose.path = path;
                goose.gatheringTarget = clickedObject;
                goose.state = 'gathering';
                goose.attackTarget = null;
            }
        });
        destination = null;
    } else if (clickedObject && clickedObject.faction === 'enemy') {
        selectedGeese.forEach(goose => {
            const path = astar.findPath(goose.x, goose.y, clickedObject.x, clickedObject.y);
            if (path) {
                goose.path = path;
                goose.attackTarget = clickedObject;
                goose.state = 'attacking';
                goose.gatheringTarget = null;
            }
        });
    } else {
        destination = { x: worldPos.x, y: worldPos.y };
        const formation = calculateFormation(worldPos.x, worldPos.y, selectedGeese.length);
        selectedGeese.forEach((goose, i) => {
            const path = astar.findPath(goose.x, goose.y, formation[i].x, formation[i].y);
            if (path) {
                goose.path = path;
                goose.state = 'moving';
                goose.gatheringTarget = null;
                goose.attackTarget = null;
            }
        });
    }
}


// --- Event Listeners ---
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handlePointerStart(touch.clientX, touch.clientY);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handlePointerMove(touch.clientX, touch.clientY);
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handlePointerEnd(); // Simplified for touch for now
});

canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handlePointerStart(e.clientX, e.clientY, e.button === 2);
    startDragPos = { x: e.clientX, y: e.clientY }; // Store initial position for command vs pan check
});

canvas.addEventListener('mousemove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', (e) => {
    e.preventDefault();
    handlePointerEnd(e.clientX, e.clientY, e.button === 2);
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

canvas.addEventListener('wheel', handleZoom);


// Game loop
function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#1a1a1a'; // Very dark gray for space outside the map
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // Apply camera transformations
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Draw world background
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, world.width, world.height);

    // Update grid obstacles
    grid.updateObstacles(gameObjects);


    // Update and draw game objects
    for (let i = gameObjects.length - 1; i >= 0; i--) {
        const obj = gameObjects[i];
        obj.update();
        obj.draw();

        if (obj.type === 'breadcrumb' && obj.amount <= 0) {
            gameObjects.splice(i, 1);
            // Set any goose targeting this to null
            gameObjects.forEach(g => {
                if (g.type === 'goose' && g.gatheringTarget === obj) {
                    g.gatheringTarget = null;
                }
            });
        }

        // Handle dead units
        if (obj.health <= 0) {
            gameObjects.splice(i, 1);
            if (obj.type === 'goose') {
                const index = selectedGeese.indexOf(obj);
                if (index > -1) {
                    selectedGeese.splice(index, 1);
                }
            }
            // Stop any geese from attacking the dead unit
            gameObjects.forEach(g => {
                if (g.type === 'goose' && g.attackTarget === obj) {
                    g.attackTarget = null;
                    g.state = 'idle';
                }
            });
        }
    }

    // Draw destination marker
    if (destination) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(destination.x, destination.y, 10, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore(); // Restore to screen space

    // Draw selection box in screen space
    if (isDragging && (Math.abs(startDragPos.x - endDragPos.x) > 5 || Math.abs(startDragPos.y - endDragPos.y) > 5)) {
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        ctx.strokeRect(startDragPos.x, startDragPos.y, endDragPos.x - startDragPos.x, endDragPos.y - startDragPos.y);
    }

    // Draw breadcrumb count
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Breadcrumbs: ${breadcrumbs}`, 10, 30);




    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();
