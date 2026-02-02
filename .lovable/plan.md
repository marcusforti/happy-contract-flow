

## Plano: Otimizar Carregamento do Video Hero no Mobile

### Problema Identificado
O video hero (`hero-video.mp4`) pode estar muito pesado para conexoes mobile, causando lentidao ou falha no carregamento. Atualmente o video:
- Nao tem poster image (thumbnail de fallback)
- Nao tem indicador de loading
- Nao tem preload strategy otimizada
- Carrega imediatamente mesmo em conexoes lentas

### Solucao Proposta

**1. Adicionar Poster Image (Thumbnail)**
- Criar/usar uma imagem estatica como placeholder enquanto o video carrega
- Mostra conteudo visual imediato mesmo antes do video estar pronto

**2. Adicionar Loading State**
- Mostrar um skeleton/loader animado enquanto o video carrega
- Detectar quando o video esta pronto para reproduzir (`onCanPlay` event)

**3. Otimizar Atributos do Video**
- Adicionar `preload="auto"` para comecar a baixar o video imediatamente
- Adicionar `poster` attribute com imagem de fallback
- Garantir `playsinline` e `webkit-playsinline` para iOS

**4. Fallback Visual**
- Caso o video demore muito ou falhe, manter uma imagem de fundo com gradiente premium
- Transicao suave quando o video estiver pronto

### Detalhes Tecnicos

**Arquivo a modificar:** `src/pages/Index.tsx`

```text
Mudancas no componente de video:
- Estado: const [videoLoaded, setVideoLoaded] = useState(false)
- Evento: onCanPlay={() => setVideoLoaded(true)}
- Atributos: preload="auto", poster={posterImage}
- Condicional: mostrar skeleton enquanto !videoLoaded
```

**Estrutura da Hero Section:**
```text
1. Background com gradiente premium (sempre visivel)
2. Poster image (visivel ate video carregar)
3. Video (opacity 0 -> 1 quando carregado)
4. Overlays e conteudo (sempre visiveis)
```

### Resultado Esperado
- Pagina carrega instantaneamente com visual premium
- Video aparece suavemente quando estiver pronto
- Usuarios mobile nao ficam esperando tela em branco
- Experiencia fluida mesmo em conexoes lentas

