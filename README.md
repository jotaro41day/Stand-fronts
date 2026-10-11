# Stand Fronts 3D — Pique-Gema

O jogo roda com Three.js e Vite, offline contra bots ou em salas P2P. A câmera ortográfica fica fixa em ângulo inclinado e segue o personagem. A arena contém chão, paredes e caixas 3D com colisão. O visual usa materiais toon, contornos, sombra direcional suave e bloom leve nos impactos.

## Executar no Termux

```sh
cd ~/stand-fronts
npm install
npm run dev
```

Abra `http://localhost:5173` no celular. Em outro dispositivo da mesma rede Wi-Fi, use o endereço de rede mostrado pelo Vite.

- Computador: WASD ou setas para mover; segure o botão esquerdo do mouse para mirar e solte para atacar. Espaço ataca com mira automática.
- Celular: joystick esquerdo para mover. Toque rápido no botão direito para atacar o alvo mais próximo; segure e arraste para mirar, depois solte para disparar. Voltar ao centro do botão antes de soltar cancela o ataque. É possível mover e mirar ao mesmo tempo.

O canvas acompanha o tamanho da janela e usa a densidade de pixels do aparelho até 2×. O compositor recebe essa resolução física; o bloom aplica sua redução interna sobre ela.

## Modelos

Os arquivos enviados por você estão em `src/assets/`: `hero.glb` é Johnny e `stand.glb` é Tusk Act 3. Não houve geração pelo Gessa. O carregamento usa GLTFLoader; se um arquivo falhar, o jogo mantém o modelo geométrico provisório correspondente.

Johnny e Tusk Act 3 usam novamente as texturas de cor 2048×2048 dos arquivos originais. O shader toon usa apenas essas texturas, então os mapas de normal e metal/aspereza foram removidos dos GLB com `python scripts/trim-toon-glb.py src/assets/hero.glb src/assets/stand.glb`. Os arquivos resultantes somam 2,97 MB (`hero.glb`: 1.808.396 bytes; `stand.glb`: 1.158.424 bytes). O tamanho dos arquivos é adequado para testar no celular; as texturas de 2048 px usam mais memória gráfica que as versões de 1024 px.

O rig do Johnny é criado em `src/models/johnnyRig.js` ao carregar o GLB: sete ossos para quadril, tronco, cabeça, pernas e braços. Os pesos dos vértices são calculados pela posição com transição suave entre regiões; peças separadas dos braços e pernas são identificadas pela posição da peça para impedir que a calça acompanhe o soco. `src/models/johnnyAnimator.js` anima a respiração, a caminhada conforme o deslocamento real e o soco ao atirar. O contorno do personagem acompanha a mesma malha animada. Uma prévia vertical das poses está em `screenshots/johnny-rig-mobile.png`.

O Tusk Act 3 também recebe sete ossos em `src/models/tuskRig.js`, com pesos calculados para suas proporções e peças separadas. Ele flutua atrás do Johnny conforme a direção em que o jogador olha, sem ciclo de passos; `src/models/tuskAnimator.js` mantém as pernas paradas e anima o golpe do braço direito ao atirar. A prévia em tamanho de celular está em `screenshots/tusk-rig-mobile.png`.

## Verificar

```sh
npm test
npm run build
```

## APK Android sem Android Studio

O projeto usa Capacitor 6 para compilar com Java 17. Para gerar o APK no GitHub, envie o projeto ao repositório e execute **Actions → Android APK → Run workflow**. O arquivo para baixar aparece no artefato `stand-fronts-debug-apk`. O workflow também roda em push e pull request; ele cria `android/` se a pasta não estiver no repositório. O APK é de depuração, sem chave de assinatura de distribuição no código.

No Termux, `npm run build` e `npx cap sync android` atualizam os arquivos do app. A compilação `assembleDebug` acontece no GitHub Actions, que instala o SDK Android no runner. O app abre em paisagem, em tela imersiva; durante a partida mantém a tela acesa. Voltar sai da partida para o menu ou fecha o app se o menu já estiver aberto.

## PWA offline

Depois de `npm run build`, rode `npm run preview` e abra a página no navegador. O manifest permite instalar o jogo, e o service worker guarda HTML, JavaScript, CSS e os quatro GLB para jogar offline depois da primeira carga completa. Salas P2P ainda precisam de conexão para alcançar o serviço de sinalização do PeerJS.
