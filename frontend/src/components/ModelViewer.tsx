/**
 * 3D Model Viewer Component
 * Renders STL and GLB/GLTF models using React Three Fiber
 */
import React, { Suspense, useRef, useState, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
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
  showControlsHint?: boolean;
}

/**
 * STL Model component
 */
function STLModel({ url, rotation, meshRef, scale = { x: 1, y: 1, z: 1 }, onDimensions, baseSizeCm = 0 }: { url: string; rotation?: { x?: number; y?: number; z?: number }; meshRef: React.RefObject<THREE.Mesh>; scale?: { x: number; y: number; z: number }; onDimensions?: (dims: { width: number; height: number; depth: number }, baseSize: { width: number; height: number; depth: number }) => void; baseSizeCm?: number }) {
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

  const stlPlaneRef = useRef<THREE.Mesh>(null!);

  // After every render, measure the mesh's actual world bbox and position the plane.
  // useLayoutEffect runs after children but before paint — no visual lag.
  useLayoutEffect(() => {
    if (!stlPlaneRef.current || !meshRef.current) return;
    const box = new THREE.Box3().setFromObject(meshRef.current);
    if (!box.isEmpty()) {
      stlPlaneRef.current.position.y = box.min.y - 0.01;
    }
  });

  return (
    <group>
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
      {baseSizeCm > 0 && (
        <mesh
          ref={stlPlaneRef}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[baseSizeCm, baseSizeCm]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      )}
    </group>
  );
}

/**
 * GLB/GLTF Model component
 */
function GLBModel({ url, rotation, groupRef, scale = { x: 1, y: 1, z: 1 }, onDimensions, baseSizeCm = 0 }: { url: string; rotation?: { x?: number; y?: number; z?: number }; groupRef: React.RefObject<THREE.Group>; scale?: { x: number; y: number; z: number }; onDimensions?: (dims: { width: number; height: number; depth: number }, baseSize: { width: number; height: number; depth: number }) => void; baseSizeCm?: number }) {
  // Clear cache for this URL when component mounts to ensure fresh load
  useEffect(() => {
    return () => {
      // Cleanup: preload cache on unmount
      useGLTF.clear(url);
    };
  }, [url]);

  const { scene } = useGLTF(url);

  const glbPlaneRef = useRef<THREE.Mesh>(null!);

  // After every render, measure groupRef's actual world bbox and position the plane.
  // useLayoutEffect on GLBModel fires AFTER Center's useLayoutEffect (child-before-parent order),
  // so Center has already applied its centering translation when we measure.
  useLayoutEffect(() => {
    if (!glbPlaneRef.current || !groupRef.current) return;
    const box = new THREE.Box3().setFromObject(groupRef.current);
    if (!box.isEmpty()) {
      glbPlaneRef.current.position.y = box.min.y - 0.01;
    }
  });

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
  }, [scene, scale, onDimensions]);

  return (
    <group>
      <Center>
        <group ref={groupRef} scale={[scale.x, scale.y, scale.z]}>
          <primitive object={scene.clone()} />
        </group>
      </Center>
      {baseSizeCm > 0 && (
        <mesh
          ref={glbPlaneRef}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[baseSizeCm, baseSizeCm]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      )}
    </group>
  );
}

/**
 * Test WebGL availability before mounting a Canvas.
 * Creates a temporary canvas, checks for a context, then immediately releases it.
 */
function isWebGLAvailable(): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    const gl =
      testCanvas.getContext('webgl2') ||
      testCanvas.getContext('webgl') ||
      testCanvas.getContext('experimental-webgl');
    if (!gl) return false;
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
    ext?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * ErrorBoundary to catch WebGL context errors and avoid white screen
 */
class WebGLErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] bg-slate-900 rounded-lg flex flex-col items-center justify-center gap-3 p-6">
          <p className="text-red-400 font-semibold text-sm">Impossibile avviare il visualizzatore 3D</p>
          <p className="text-slate-400 text-xs text-center">WebGL non disponibile. Ricarica la pagina o riavvia il browser.</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
          >
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Forces explicit WebGL context loss on unmount to free GPU resources.
 * Prevents Chrome from hitting the ~16-context limit after repeated modal opens.
 */
function ContextDisposer() {
  const { gl } = useThree();
  useEffect(() => {
    return () => {
      try {
        gl.dispose();
        const ctx = gl.getContext() as WebGLRenderingContext | null;
        const ext = ctx?.getExtension('WEBGL_lose_context');
        ext?.loseContext();
      } catch (_) {}
    };
  }, [gl]);
  return null;
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
const ModelViewer = forwardRef(function ModelViewer({ url, fileType, rotation, scale = { x: 1, y: 1, z: 1 }, baseSizeCm = 0, onDimensions, showControlsHint = true }: ModelViewerProps, ref) {
  const stlMeshRef = useRef<THREE.Mesh>(null!);
  const glbGroupRef = useRef<THREE.Group>(null!);

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

  if (!isWebGLAvailable()) {
    return (
      <div className="w-full h-full min-h-[300px] bg-slate-900 rounded-lg flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-red-400 font-semibold text-sm">WebGL non disponibile</p>
        <p className="text-slate-400 text-xs text-center">
          Il browser non riesce a creare un contesto 3D.<br />
          Digita <strong className="text-white">chrome://restart</strong> nella barra dell&apos;indirizzo per riavviare Chrome.
        </p>
      </div>
    );
  }

  return (
    <WebGLErrorBoundary>
    <div className="w-full h-full min-h-[300px] bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg overflow-hidden">
      <Canvas
        shadows
        frameloop="demand"
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false }}
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
          <Stage
            environment="city"
            intensity={0.5}
            adjustCamera={1.5}
            shadows={{ type: 'contact', blur: 2, opacity: 0.5 }}
          >
            {fileType === 'stl' ? (
              <STLModel url={url} rotation={rotation} meshRef={stlMeshRef} scale={scale} onDimensions={onDimensions} baseSizeCm={baseSizeCm} />
            ) : (
              <GLBModel url={url} rotation={rotation} groupRef={glbGroupRef} scale={scale} onDimensions={onDimensions} baseSizeCm={baseSizeCm} />
            )}
          </Stage>
        </Suspense>
        
        <ContextDisposer />

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
      {showControlsHint && (
        <div className="absolute bottom-2 left-2 right-2 text-center pointer-events-none">
          <p className="text-xs text-slate-400 bg-slate-900/50 inline-block px-3 py-1 rounded-full backdrop-blur-sm">
            🖱️ Ruota: click + trascina | Zoom: scroll | Pan: click destro + trascina
          </p>
        </div>
      )}
    </div>
    </WebGLErrorBoundary>
  );
});

export default ModelViewer;
