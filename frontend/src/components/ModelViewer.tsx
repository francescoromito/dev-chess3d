/**
 * 3D Model Viewer Component
 * Renders STL and GLB/GLTF models using React Three Fiber
 */
import { Suspense, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Center, Stage, useGLTF } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';

interface ModelViewerProps {
  url: string;
  fileType: 'glb' | 'stl';
  // rotation angles in degrees
  rotation?: { x?: number; y?: number; z?: number };
  // scale multiplier for the model (default 1) - now per-axis
  scale?: { x: number; y: number; z: number };
  // size of the black base plane in scene units (cm); 0 or undefined hides it
  baseSizeCm?: number;
  // callback with bounding box dimensions in scene units after scale, and base dimensions
  onDimensions?: (dims: { width: number; height: number; depth: number }, baseSize: { width: number; height: number; depth: number }) => void;
  // callback to report the model's scaled height for base plane positioning
  onModelHeight?: (height: number) => void;
}

/**
 * STL Model component
 */
function STLModel({ url, rotation, meshRef, scale = { x: 1, y: 1, z: 1 }, onDimensions, onModelHeight }: { url: string; rotation?: { x?: number; y?: number; z?: number }; meshRef: React.RefObject<THREE.Mesh>; scale?: { x: number; y: number; z: number }; onDimensions?: (dims: { width: number; height: number; depth: number }, baseSize: { width: number; height: number; depth: number }) => void; onModelHeight?: (height: number) => void }) {
  const geometry = useLoader(STLLoader, url);
  const [hovered, setHovered] = useState(false);

  // Center and scale the geometry
  geometry.computeBoundingBox();
  geometry.center();

  // Get base (unscaled) dimensions
  const baseSize = geometry.boundingBox ? {
    width: geometry.boundingBox.max.x - geometry.boundingBox.min.x,
    height: geometry.boundingBox.max.y - geometry.boundingBox.min.y,
    depth: geometry.boundingBox.max.z - geometry.boundingBox.min.z,
  } : { width: 0, height: 0, depth: 0 };

  // apply rotation when prop changes
  useEffect(() => {
    if (meshRef?.current && rotation) {
      meshRef.current.rotation.x = (rotation.x || 0) * (Math.PI / 180);
      meshRef.current.rotation.y = (rotation.y || 0) * (Math.PI / 180);
      meshRef.current.rotation.z = (rotation.z || 0) * (Math.PI / 180);
    }
  }, [rotation, meshRef]);

  // report dimensions when scale changes
  useEffect(() => {
    if (geometry.boundingBox && onDimensions) {
      const box = geometry.boundingBox;
      onDimensions({
        width: (box.max.x - box.min.x) * scale.x,
        height: (box.max.y - box.min.y) * scale.y,
        depth: (box.max.z - box.min.z) * scale.z,
      }, baseSize);
    }
  }, [geometry, scale, onDimensions, baseSize]);

  // report scaled height for base plane positioning
  useEffect(() => {
    if (onModelHeight) {
      onModelHeight(baseSize.height * scale.y);
    }
  }, [baseSize.height, scale.y, onModelHeight]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      scale={[scale.x, scale.y, scale.z]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={hovered ? '#60a5fa' : '#94a3b8'}
        metalness={0.3}
        roughness={0.4}
      />
    </mesh>
  );
}

/**
 * GLB/GLTF Model component
 */
function GLBModel({ url, rotation, groupRef, scale = { x: 1, y: 1, z: 1 }, onDimensions, onModelHeight }: { url: string; rotation?: { x?: number; y?: number; z?: number }; groupRef: React.RefObject<THREE.Group>; scale?: { x: number; y: number; z: number }; onDimensions?: (dims: { width: number; height: number; depth: number }, baseSize: { width: number; height: number; depth: number }) => void; onModelHeight?: (height: number) => void }) {
  // Clear cache for this URL when component mounts to ensure fresh load
  useEffect(() => {
    return () => {
      // Cleanup: preload cache on unmount
      useGLTF.clear(url);
    };
  }, [url]);

  const { scene } = useGLTF(url);

  useEffect(() => {
    if (groupRef?.current && rotation) {
      groupRef.current.rotation.x = (rotation.x || 0) * (Math.PI / 180);
      groupRef.current.rotation.y = (rotation.y || 0) * (Math.PI / 180);
      groupRef.current.rotation.z = (rotation.z || 0) * (Math.PI / 180);
    }
  }, [rotation, groupRef]);

  // Calculate bounding box dimensions
  useEffect(() => {
    const clonedScene = scene.clone();
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    const baseSize = { width: size.x, height: size.y, depth: size.z };
    
    if (onDimensions) {
      onDimensions({
        width: size.x * scale.x,
        height: size.y * scale.y,
        depth: size.z * scale.z,
      }, baseSize);
    }
    
    if (onModelHeight) {
      onModelHeight(size.y * scale.y);
    }
  }, [scene, scale, onDimensions, onModelHeight]);

  return (
    <Center>
      <group ref={groupRef} scale={[scale.x, scale.y, scale.z]}>
        <primitive object={scene.clone()} />
      </group>
    </Center>
  );
}

/**
 * Black base plane component - positioned below the model
 */
function BasePlane({ sizeCm, modelHeight }: { sizeCm: number; modelHeight: number }) {
  if (!sizeCm || sizeCm <= 0) return null;
  // Position plane at the bottom of the model (model is centered, so bottom is at -height/2)
  const yPosition = -modelHeight / 2 - 0.01;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yPosition, 0]} receiveShadow>
      <planeGeometry args={[sizeCm, sizeCm]} />
      <meshStandardMaterial color="#111111" />
    </mesh>
  );
}

/**
 * Loading placeholder
 */
function LoadingPlaceholder() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#94a3b8" wireframe />
    </mesh>
  );
}

/**
 * Main Model Viewer component
 */
const ModelViewer = forwardRef(function ModelViewer({ url, fileType, rotation, scale = { x: 1, y: 1, z: 1 }, baseSizeCm = 0, onDimensions }: ModelViewerProps, ref) {
  const stlMeshRef = useRef<THREE.Mesh>(null!);
  const glbGroupRef = useRef<THREE.Group>(null!);
  const [modelHeight, setModelHeight] = useState(0);

  useImperativeHandle(ref, () => ({
    exportSTL: async (): Promise<Blob | null> => {
      try {
        const exporter = new STLExporter();
        const target = stlMeshRef.current || glbGroupRef.current;
        if (!target) {
          console.error('No target mesh/group found for export');
          return null;
        }
        
        // For GLB models, we need to create a scene with all meshes
        if (glbGroupRef.current) {
          // Create a temporary scene containing all meshes
          const tempScene = new THREE.Scene();
          
          glbGroupRef.current.traverse((child: any) => {
            if (child.isMesh && child.geometry) {
              // Clone the mesh with its geometry
              const clonedGeo = child.geometry.clone();
              child.updateMatrixWorld(true);
              clonedGeo.applyMatrix4(child.matrixWorld);
              
              const clonedMesh = new THREE.Mesh(clonedGeo, new THREE.MeshBasicMaterial());
              tempScene.add(clonedMesh);
            }
          });
          
          if (tempScene.children.length === 0) {
            console.error('No meshes found in GLB model');
            return null;
          }
          
          const result = exporter.parse(tempScene, { binary: false });
          
          // Cleanup
          tempScene.traverse((child: any) => {
            if (child.geometry) child.geometry.dispose();
          });
          
          return new Blob([result as string], { type: 'model/stl' });
        }
        
        // For STL models (simple mesh)
        if (typeof target.updateMatrixWorld === 'function') target.updateMatrixWorld(true);
        const result = exporter.parse(target as any, { binary: false });
        return new Blob([result as string], { type: 'model/stl' });
      } catch (e) {
        console.error('Export STL error:', e);
        return null;
      }
    }
    ,
    exportSTLWithRotation: async (extraRotation: { x?: number; y?: number; z?: number }): Promise<Blob | null> => {
      try {
        const exporter = new STLExporter();
        const target: any = stlMeshRef.current || glbGroupRef.current;
        if (!target) return null;
        
        // Clone the geometry to apply transformations without affecting the original
        let geometryToExport: THREE.BufferGeometry | null = null;
        
        if (target.geometry) {
          // It's a Mesh with geometry
          geometryToExport = target.geometry.clone();
        } else if (target.children) {
          // It's a Group, merge all children geometries
          const geometries: THREE.BufferGeometry[] = [];
          target.traverse((child: any) => {
            if (child.geometry) {
              const clonedGeo = child.geometry.clone();
              child.updateMatrixWorld(true);
              clonedGeo.applyMatrix4(child.matrixWorld);
              geometries.push(clonedGeo);
            }
          });
          if (geometries.length > 0) {
            geometryToExport = geometries[0];
            // For simplicity, just use first geometry
          }
        }
        
        if (!geometryToExport) return null;
        
        // Build transformation matrix
        const matrix = new THREE.Matrix4();
        
        // Apply current rotation + extra rotation
        const rad = Math.PI / 180;
        const euler = new THREE.Euler(
          target.rotation.x + (extraRotation.x || 0) * rad,
          target.rotation.y + (extraRotation.y || 0) * rad,
          target.rotation.z + (extraRotation.z || 0) * rad
        );
        
        // Apply current scale * 10
        const finalScale = new THREE.Vector3(
          target.scale.x * 10,
          target.scale.y * 10,
          target.scale.z * 10
        );
        
        matrix.compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion().setFromEuler(euler), finalScale);
        
        // Apply matrix to cloned geometry
        geometryToExport.applyMatrix4(matrix);
        
        // Create temporary mesh for export
        const tempMesh = new THREE.Mesh(geometryToExport, new THREE.MeshBasicMaterial());
        
        const result = exporter.parse(tempMesh, { binary: false });
        
        // Cleanup
        geometryToExport.dispose();
        
        return new Blob([result as string], { type: 'model/stl' });
      } catch (e) {
        console.error('Export error:', e);
        return null;
      }
    },
    exportGLB: async (): Promise<Blob | null> => {
      try {
        const target = glbGroupRef.current;
        if (!target) {
          console.error('No GLB group found for export');
          return null;
        }
        
        console.log('GLB Export - original scale:', target.scale.toArray());
        console.log('GLB Export - original rotation:', target.rotation.toArray());
        
        // Clone the scene to apply transformations
        const clonedGroup = target.clone(true);
        
        // Bake transformations into geometry
        clonedGroup.updateMatrixWorld(true);
        clonedGroup.traverse((child: any) => {
          if (child.isMesh && child.geometry) {
            // Apply the world matrix to the geometry
            child.geometry = child.geometry.clone();
            child.geometry.applyMatrix4(child.matrixWorld);
            // Reset the mesh transform since it's now in the geometry
            child.position.set(0, 0, 0);
            child.rotation.set(0, 0, 0);
            child.scale.set(1, 1, 1);
            child.updateMatrix();
          }
        });
        
        // Reset the group transform too
        clonedGroup.position.set(0, 0, 0);
        clonedGroup.rotation.set(0, 0, 0);
        clonedGroup.scale.set(1, 1, 1);
        
        const exporter = new GLTFExporter();
        
        return new Promise((resolve) => {
          exporter.parse(
            clonedGroup,
            (result) => {
              console.log('GLB Export result type:', result instanceof ArrayBuffer ? 'ArrayBuffer' : 'JSON');
              if (result instanceof ArrayBuffer) {
                console.log('GLB Export size:', result.byteLength);
                resolve(new Blob([result], { type: 'model/gltf-binary' }));
              } else {
                // JSON result
                const jsonStr = JSON.stringify(result);
                console.log('GLB Export JSON size:', jsonStr.length);
                resolve(new Blob([jsonStr], { type: 'model/gltf+json' }));
              }
            },
            (error) => {
              console.error('GLB export error:', error);
              resolve(null);
            },
            { binary: true } // Export as GLB (binary)
          );
        });
      } catch (e) {
        console.error('Export GLB error:', e);
        return null;
      }
    }
  }));

  return (
    <div className="w-full h-full min-h-[300px] bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#1e293b']} />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.15}
          penumbra={1}
          intensity={1}
          castShadow
        />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        {/* Model */}
        <Suspense fallback={<LoadingPlaceholder />}>
          {/* Black base plane - positioned below model */}
          {baseSizeCm > 0 && <BasePlane sizeCm={baseSizeCm} modelHeight={modelHeight} />}
          <Stage
            environment="city"
            intensity={0.5}
            adjustCamera={1.5}
            shadows={{ type: 'contact', blur: 2, opacity: 0.5 }}
          >
            {fileType === 'stl' ? (
              <STLModel url={url} rotation={rotation} meshRef={stlMeshRef} scale={scale} onDimensions={onDimensions} onModelHeight={setModelHeight} />
            ) : (
              <GLBModel url={url} rotation={rotation} groupRef={glbGroupRef} scale={scale} onDimensions={onDimensions} onModelHeight={setModelHeight} />
            )}
          </Stage>
        </Suspense>
        
        {/* Controls */}
        <OrbitControls
          makeDefault
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
          autoRotate={false}
        />
      </Canvas>
      
      {/* Controls hint */}
      <div className="absolute bottom-2 left-2 right-2 text-center">
        <p className="text-xs text-slate-400">
          🖱️ Ruota: click + trascina | Zoom: scroll | Pan: click destro + trascina
        </p>
      </div>
    </div>
  );
});

export default ModelViewer;
