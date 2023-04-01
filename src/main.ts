import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import gsap from 'gsap'
import GUI from 'lil-gui'

import Img1 from './assets/1.jpg'
import Img2 from './assets/2.jpeg'
import Img3 from './assets/3.jpeg'
import Mask from './assets/mask.jpg'

import './style.css'
import { Gesture } from '@use-gesture/vanilla'

const CustomOffsetShaderPass = {
  uniforms: {
    uProgress: { value: 0.0 },
    tDiffuse: { value: null },
  },

  vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

		uniform vec2 center;
		uniform float angle;
		uniform float scale;
		uniform vec2 tSize;

		uniform sampler2D tDiffuse;

    uniform float uProgress;

		varying vec2 vUv;

		void main() {
      vec2 p = vUv;
      // p += 0.1 * sin(10. * vUv.x);

      if (p.x < .25) {
      } else if (p.x < .5) {
        p.x -= .25 * uProgress;
      } else if (p.x < .75) {
        p.x -= .35 * uProgress;
      } else {
        p.x -= .65 * uProgress;
      }

      // p.x += uProgress * 0.01;

			vec4 color = texture2D( tDiffuse, p );

			gl_FragColor = color;

		}`,
}

const CustomShaderPass = {
  uniforms: {
    uProgress: { value: 0.0 },
    tDiffuse: { value: null },
  },

  vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

		uniform vec2 center;
		uniform float angle;
		uniform float scale;
		uniform vec2 tSize;

		uniform sampler2D tDiffuse;

    uniform float uProgress;

		varying vec2 vUv;

		void main() {
      vec2 p = vUv;

      vec4 r = texture2D(tDiffuse, p + uProgress * vec2(.1, 0.));
      vec4 g = texture2D(tDiffuse, p);
      vec4 b = texture2D(tDiffuse, p - uProgress * vec2(.1, .0));

			vec4 color = vec4(r.r, g.g, b.b, 1.);

			gl_FragColor = color;

		}`,
}

class Sketch {
  private domElement: HTMLElement
  private windowSize: THREE.Vector2
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private clock: THREE.Clock
  private renderer: THREE.WebGLRenderer
  private geometry: THREE.PlaneGeometry | null = null
  private groups: THREE.Group[] = []
  private mouse: THREE.Vector2 = new THREE.Vector2(0, 0)
  private composer: EffectComposer | null = null
  private offsetShaderPass: ShaderPass | null = null
  private rgbShaderPass: ShaderPass | null = null

  private gui: GUI

  config = {
    animate: true,
    progress: 0,
    runAnimation: () => {
      this.runAnimation()
    },
  }

  constructor(el: HTMLElement) {
    this.domElement = el

    this.windowSize = new THREE.Vector2(
      this.domElement.offsetWidth,
      this.domElement.offsetHeight,
    )

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.windowSize.x / this.windowSize.y,
      1,
      3000,
    )
    this.camera.position.set(0, 0, 900)
    this.scene.add(this.camera)

    this.clock = new THREE.Clock()

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.outputEncoding = THREE.sRGBEncoding
    this.domElement.append(this.renderer.domElement)

    this.gui = new GUI()

    this.addObject()
    this.addGUI()
    this.addEventListener()
    this.addGestures()
    this.postProcessing()
    this.resize()
    this.render()
  }

  addObject() {
    const maskTexture = new THREE.TextureLoader().load(Mask)
    const textures = [Img1, Img2, Img3].map(img =>
      new THREE.TextureLoader().load(img),
    )

    this.geometry = new THREE.PlaneGeometry(1920, 1080)

    for (let i = 0; i < textures.length; i++) {
      const group = new THREE.Group()
      const texture = textures[i]
      for (let j = 0; j < 3; j++) {
        const material = new THREE.MeshBasicMaterial({ map: texture })
        const mesh = new THREE.Mesh(this.geometry.clone(), material)
        mesh.position.z = j * 100

        if (j > 0) {
          material.alphaMap = maskTexture
          material.transparent = true
        }
        group.add(mesh)
        group.position.x = i * 2500
      }
      this.groups.push(group)
    }

    this.groups.forEach(group => {
      this.scene.add(group)
    })
  }

  addGUI() {
    this.gui.add(this.config, 'animate').name('Animate')
    this.gui
      .add(this.config, 'progress', 0, 1, 0.01)
      .name('Progress')
      .onChange((val: unknown) => {
        if (
          typeof val === 'number' &&
          this.offsetShaderPass &&
          this.rgbShaderPass
        ) {
          this.offsetShaderPass.uniforms.uProgress.value = val
          this.rgbShaderPass.uniforms.uProgress.value = val
        }
      })
    this.gui.add(this.config, 'runAnimation').name('Run Animation')
  }

  resize() {
    this.windowSize.set(
      this.domElement.offsetWidth,
      this.domElement.offsetHeight,
    )

    this.camera.aspect = this.windowSize.x / this.windowSize.y
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(this.windowSize.x, this.windowSize.y)
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))

    this.composer?.setSize(this.windowSize.x, this.windowSize.y)
    this.composer?.setPixelRatio(Math.min(2, window.devicePixelRatio))
  }

  addEventListener() {
    window.addEventListener('resize', this.resize.bind(this))
  }

  addGestures() {
    new Gesture(this.renderer.domElement, {
      onMove: ({ values: [x, y] }) => {
        this.mouse.set(
          (x / this.windowSize.x) * 2 - 1,
          -(y / this.windowSize.y) * 2 + 1,
        )
      },
    })
  }

  postProcessing() {
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.offsetShaderPass = new ShaderPass(CustomOffsetShaderPass)
    this.rgbShaderPass = new ShaderPass(CustomShaderPass)
    this.composer.addPass(this.offsetShaderPass)
    this.composer.addPass(this.rgbShaderPass)
  }

  runAnimation() {
    const tl = gsap.timeline()
    tl.to(this.camera.position, {
      x: 2500,
      duration: 1.5,
      ease: 'power4.inOut',
    })
    tl.to(
      this.camera.position,
      {
        z: 700,
        duration: 1,
        ease: 'power4.inOut',
      },
      0,
    )
    tl.to(
      this.camera.position,
      {
        z: 900,
        duration: 1,
        ease: 'power4.inOut',
      },
      1,
    )
    tl.to(
      this.offsetShaderPass!.uniforms.uProgress,
      {
        value: 1,
        duration: 1,
        ease: 'power2.inOut',
      },
      0,
    )
    tl.to(
      this.offsetShaderPass!.uniforms.uProgress,
      {
        value: 0,
        duration: 1,
        ease: 'power2.inOut',
      },
      1,
    )
    tl.to(
      this.rgbShaderPass!.uniforms.uProgress,
      {
        value: 1,
        duration: 1,
        ease: 'power2.inOut',
      },
      0,
    )
    tl.to(
      this.rgbShaderPass!.uniforms.uProgress,
      {
        value: 0,
        duration: 1,
        ease: 'power2.inOut',
      },
      1,
    )
  }

  render() {
    const elapsedTime = this.clock.getElapsedTime()
    const oscilator = Math.sin(elapsedTime * 0.5) * 0.5 + 0.5

    this.groups.forEach(group => {
      group.rotation.x = THREE.MathUtils.lerp(
        group.rotation.x,
        -this.mouse.y * 0.1,
        0.1,
      )
      group.rotation.y = THREE.MathUtils.lerp(
        group.rotation.y,
        this.mouse.x * 0.1,
        0.1,
      )

      group.children.forEach((mesh, i) => {
        mesh.position.z = THREE.MathUtils.lerp(
          mesh.position.z,
          i * 100 - oscilator * 100,
          0.1,
        )
      })
    })

    // this.renderer.render(this.scene, this.camera)
    this.composer?.render()

    window.requestAnimationFrame(this.render.bind(this))
  }
}

new Sketch(document.getElementById('app')!)
