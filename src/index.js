const canvas = document.getElementById("renderCanvas");
import * as BABYLON from "@babylonjs/core/Legacy/legacy";
import HavokPhysics from "@babylonjs/havok";

const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });

const createScene = async function () {
    const showDebug = false, showAxes = true;

    // This creates a basic Babylon Scene object (non-mesh)
    const scene = new BABYLON.Scene(engine);


    // initialize plugin
    const havokInstance = await HavokPhysics();
    const hk = new BABYLON.HavokPlugin(true, havokInstance);
    scene.enablePhysics(new BABYLON.Vector3(0, -10, 0), hk);

    const camera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 20, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());

    // const camera = new BABYLON.ArcRotateCamera("camera2", 0, 0, 10, new BABYLON.Vector3(0,0,0), scene);
    // camera.setPosition(new BABYLON.Vector3(0,10,-10));

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);
    // camera.inputs.clear();


    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 50, 50), scene);
    light.intensity = 1;


    const skybox = BABYLON.MeshBuilder.CreateBox("skybox", { size: 100 }, scene);
    const skyboxMat = new BABYLON.StandardMaterial("skyboxMat", scene);
    skyboxMat.backFaceCulling = false;
    skyboxMat.disableLighting = true;
    skybox.material = skyboxMat;

    skybox.infiniteDistance = true;

    skyboxMat.reflectionTexture = new BABYLON.CubeTexture("textures/skybox", scene);
    skyboxMat.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    let level_data = {};
    await fetch('./level_data.json', {cache: "no-store"}).then((res) => res.json()).then((json) => {
        console.log("load platform.json", json)
        level_data = json;
    });

    let ball_data = {};
    if (level_data["ball"]) ball_data = level_data.ball

    const sphereDia = ball_data.diameter ? ball_data.diameter : 1;
    const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: sphereDia }, scene);
    const sphereMat = new BABYLON.StandardMaterial("sphereMat");
    sphereMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    sphere.material = sphereMat;


    const bInitX = ball_data.initX ? ball_data.initX : 4.4;
    const bInitY = ball_data.initY ? ball_data.initY : 4.4;
    const bInitZ = ball_data.initZ ? ball_data.initZ : 4.4;

    sphere.position.x = bInitX;
    sphere.position.y = bInitY;
    sphere.position.z = bInitZ;


    let sphereAggregate = new BABYLON.PhysicsAggregate(sphere, BABYLON.PhysicsShapeType.SPHERE, { mass: ball_data.diameter ? ball_data.diameter : 1
        , startAsleep: false });





    // Set Bottom Mesh

    let [bottomW, bottomH, bottomD] = [10, 1, 10];

    if (level_data["bottom"]) {
        let bottom = level_data.bottom;
        [bottomW, bottomH, bottomD] = [bottom.width, bottom.height, bottom.depth]
    }

    let bottomMesh = new BABYLON.MeshBuilder.CreateBox("bottom", {
        width: bottomW, height: bottomH, depth: bottomD
    })

    let bottomPos = bottomMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    let bottomColors = [];

    for (var i = 0; i < bottomPos.length; i += 3) {
        // RGBA
        bottomColors.push(1);
        bottomColors.push(1);
        bottomColors.push(1);
        bottomColors.push(1);
    }

    bottomMesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, bottomColors)
    bottomMesh.rotationQuaternion = BABYLON.Quaternion.Identity();
    bottomMesh.position = new BABYLON.Vector3(0, -bottomH / 2, 0);


     // Hole Subtractions

     if(level_data["holes"]){
        
        let containerCSG = BABYLON.CSG.FromMesh(bottomMesh);

        let holes = level_data.holes;


        holes.forEach(hole => {
            let mesh = new BABYLON.MeshBuilder.CreateCylinder(hole.name,{
                diameter: sphereDia * 1.1, height: bottomH * 3
            })

            mesh.position = new BABYLON.Vector3(hole.x, -bottomH / 2, hole.z);
            let holeCSG = BABYLON.CSG.FromMesh(mesh);
            containerCSG.subtractInPlace(holeCSG);
            mesh.dispose();
        })

        bottomMesh.dispose();
        bottomMesh = containerCSG.toMesh("csg_container")
    }


    let walls = {};

    if (level_data["walls"]) {
        walls = level_data.walls;
    } else {
        walls = [
            { name: "wall0", x: -5.5, y: 1, z: 0, rotY: Math.PI / 2, colorR: 1, colorG: 0, colorB: 0 },
            { name: "wall1", x: 0, y: 1, z: 5.5, rotY: 0, colorR: 0, colorG: 1, colorB: 0 },
            { name: "wall2", x: 5.5, y: 1, z: 0, rotY: Math.PI / 2, colorR: 0, colorG: 0, colorB: 1 },
            { name: "wall3", x: 0, y: 1, z: -5.5, rotY: 0, colorR: 0, colorG: 0, colorB: 0 },
        ]
    }

    let wallMeshes = []

    walls.forEach(wall => {
        const R = wall.colorR, G = wall.colorG, B = wall.colorB;

        let mesh = BABYLON.MeshBuilder.CreateBox(wall.name, {
            width: wall.w,
            height: wall.h,
            depth: wall.d,
            updatable: true,
        });


        let positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

        let colors = []
        for (var i = 0; i < positions.length; i += 3) {
            colors.push(R);
            colors.push(G);
            colors.push(B);
            colors.push(1);
        }
        mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);

        mesh.position = new BABYLON.Vector3(wall.x, wall.y, wall.z)

        mesh.rotation = new BABYLON.Vector3( wall.rotX ? wall.rotX / 180.0 * Math.PI : 0,
                                             wall.rotY ? wall.rotY / 180.0 * Math.PI : 0,
                                             wall.rotZ ? wall.rotZ / 180.0 * Math.PI : 0) 

        wallMeshes.push(mesh)
    })


    let allMesh = [...wallMeshes]
    allMesh.unshift(bottomMesh)
    let containerMesh = BABYLON.Mesh.MergeMeshes(allMesh);

   


    





    // Create a static box shape.
    let bottomBody = new BABYLON.PhysicsBody(containerMesh, BABYLON.PhysicsMotionType.ANIMATED, false, scene);
    let bottomShape = new BABYLON.PhysicsShapeMesh(containerMesh, scene);
    bottomBody.shape = bottomShape;


    var CoT = new BABYLON.TransformNode("root");
    containerMesh.parent = CoT;  //apply to Box

    const keysPressed = {};

    function handleKeyPress(event) {
        console.log(containerMesh.absoluteRotationQuaternion)
        const forceStrength = 14; // Adjust force strength as needed
        const rotationStep = Math.PI / 720


        // Update the keysPressed object based on the event type
        if (event.type === "keydown") {
            keysPressed[event.code] = true;
        } else if (event.type === "keyup") {
            keysPressed[event.code] = false;
        }



        const curr = containerMesh.absoluteRotationQuaternion;
        if (keysPressed["KeyI"] || keysPressed["KeyJ"] || keysPressed["KeyK"] || keysPressed["KeyL"]) {
            // let totalRotation = new BABYLON.Quaternion();
            // Start with identity quaternion
            let totalRotation = BABYLON.Quaternion.Identity()

            if (keysPressed["KeyI"]) {
                // X-axis rotation
                // totalRotation = totalRotation.multiply(BABYLON.Quaternion.FromEulerAngles(1 / 64, 0, 0));

                bottomBody.disablePreStep = false;
                containerMesh.addRotation(rotationStep, 0, 0);
                scene.onAfterRenderObservable.addOnce(() => {
                    // Turn disablePreStep on again for maximum performance
                    bottomBody.disablePreStep = true;
                })
            }
            if (keysPressed["KeyK"]) {
                // X-axis rotation
                // totalRotation = totalRotation.multiply(BABYLON.Quaternion.FromEulerAngles(-1 / 64, 0, 0)); 
                bottomBody.disablePreStep = false;
                containerMesh.addRotation(-rotationStep, 0, 0);
                scene.onAfterRenderObservable.addOnce(() => {
                    // Turn disablePreStep on again for maximum performance
                    bottomBody.disablePreStep = true;
                })
            }
            if (keysPressed["KeyJ"]) {
                // Z-axis rotation
                // totalRotation = totalRotation.multiply(BABYLON.Quaternion.FromEulerAngles(0, 0, 1 / 64)); 
                bottomBody.disablePreStep = false;
                CoT.addRotation(0, 0, rotationStep);
                scene.onAfterRenderObservable.addOnce(() => {
                    // Turn disablePreStep on again for maximum performance
                    bottomBody.disablePreStep = true;
                })
            }
            if (keysPressed["KeyL"]) {
                // Z-axis rotation
                // totalRotation = totalRotation.multiply(BABYLON.Quaternion.FromEulerAngles(0, 0, -1 / 64)); 
                bottomBody.disablePreStep = false;
                CoT.addRotation(0, 0, -rotationStep);
                scene.onAfterRenderObservable.addOnce(() => {
                    // Turn disablePreStep on again for maximum performance
                    bottomBody.disablePreStep = true;
                })
            }
            // ... (similar for keys K and L)

            // const finalRotation = curr.multiply(totalRotation);
            // bottomBody.setTargetTransform(containerMesh.absolutePosition, finalRotation);
        } else {
            // const finalRotation = curr.multiply(BABYLON.Quaternion.FromEulerAngles(0, 0, 0));
            // bottomBody.setTargetTransform(containerMesh.absolutePosition, finalRotation);
        }


        if (keysPressed["KeyC"]) {
            sphereAggregate.body.applyImpulse(new BABYLON.Vector3(0, forceStrength / 20, 0), sphere.absolutePosition);
        }
        if (keysPressed["KeyW"]) {
            sphereAggregate.body.applyForce(new BABYLON.Vector3(0, 0, forceStrength), sphere.absolutePosition);
        }
        if (keysPressed["KeyA"]) {
            sphereAggregate.body.applyForce(new BABYLON.Vector3(-forceStrength, 0, 0), sphere.absolutePosition);
        }
        if (keysPressed["KeyS"]) {
            sphereAggregate.body.applyForce(new BABYLON.Vector3(0, 0, -forceStrength), sphere.absolutePosition);
        }
        if (keysPressed["KeyD"]) {
            sphereAggregate.body.applyForce(new BABYLON.Vector3(forceStrength, 0, 0), sphere.absolutePosition);
        }
        if (keysPressed["KeyP"]) {
            bottomBody.disablePreStep = false;
            containerMesh.rotation = new BABYLON.Vector3(0, 0, 0);
            CoT.rotation = new BABYLON.Vector3(0, 0, 0);
        }
        if (keysPressed["KeyR"]) {
            sphereAggregate.body.disablePreStep = false;
            sphereAggregate.transformNode.position = new BABYLON.Vector3(bInitX, bInitY, bInitZ)
        }
    }

    // Add event listeners for keydown and keyup events
    document.addEventListener("keydown", handleKeyPress);
    document.addEventListener("keyup", handleKeyPress);

    if (showDebug) scene.debugLayer.show();
    if (showAxes) {
        const axes = new BABYLON.Debug.AxesViewer(scene, 1)
        axes.xAxis.parent = containerMesh;
        axes.yAxis.parent = containerMesh;
        axes.zAxis.parent = containerMesh;
    }



    scene.getPhysicsEngine().setTimeStep(1 / 60); // Set to 60 FPS
    return scene;

};


createScene().then((scene) => {
    engine.runRenderLoop(function () {
        if (scene) {
            scene.render();
        }
    });
});
// Resize
window.addEventListener("resize", function () {
    engine.resize();
});

// focus the canvas 
canvas.focus();
