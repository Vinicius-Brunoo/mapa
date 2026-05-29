# 🗺️ Planejador de Rotas Escolares Premium

Um aplicativo web interativo de alto padrão para planejamento e otimização de rotas escolares, desenvolvido com **Leaflet.js**, **Leaflet Routing Machine**, e uma interface futurista baseada em **Glassmorphism** com tons escuros e acentos neon (Ciano & Magenta).

## 🚀 Demonstração Visual e Estilo
* **Design System Customizado:** Totalmente responsivo, com tipografia moderna (`Outfit`) e micro-interações dinâmicas.
* **Glassmorphism Profissional:** Cartões translúcidos com efeitos de desfoque de fundo (`backdrop-filter`) e bordas gradientes sutis.
* **Tema Escuro de Alta Fidelidade:** Utiliza o mapa base `CartoDB Dark Matter` para um contraste deslumbrante com as linhas de rota neon.

---

## 🛠️ Tecnologias Utilizadas
1. **Core:** HTML5, CSS3 (Custom Variables) & Vanilla JavaScript (ES6+).
2. **Mapas & Rotas:**
   * [Leaflet.js](https://leafletjs.com/) (Biblioteca principal para mapas interativos).
   * [Leaflet Routing Machine](http://www.liedman.net/leaflet-routing-machine/) (Cálculo e exibição de trajetos otimizados).
3. **Geocodificação & CEP:**
   * **ViaCEP API:** Autocompletar rápido e robusto via CEP (100% livre de CORS).
   * **OSM Nominatim API:** Geocodificação reversa de endereços com fallback inteligente.

---

## 🔒 Solução de CORS e Bloqueios (JSONP Seguro)
Para garantir que o aplicativo funcione perfeitamente em ambientes de desenvolvimento local (`localhost`), implementamos uma solução nativa de **JSONP (JSON with Padding)** para chamadas à API **OSM Nominatim**:
* **O Problema:** Requisições normais via `fetch()` do browser a partir de `localhost` geram bloqueios de política de CORS ao incluir cabeçalhos customizados, ou quando os servidores da Nominatim bloqueiam requisições de origem anônima.
* **A Solução:** Utilização do parâmetro `json_callback` oficial do Nominatim, injetando scripts dinamicamente no cabeçalho do documento para carregar as coordenadas de forma segura e imediata, sem necessidade de servidores proxy externos ou desativação de segurança do navegador.

---

## 📂 Estrutura do Projeto
```bash
mapa/
├── index.html   # Estrutura e carregamento de dependências via CDN
├── style.css    # Estilização completa e Design System Neon
└── app.js       # Regras de negócios, JSONP, Leaflet e ViaCEP
```

---

## 💻 Como Executar
1. Clone o repositório ou baixe os arquivos.
2. Inicie um servidor estático local na pasta do projeto. Exemplo com Python:
   ```bash
   python3 -m http.server 8080
   ```
3. Abra `http://localhost:8080` no seu navegador.
4. Digite o endereço de origem, adicione paradas intermediárias se necessário, digite o destino e clique em **Calcular Rota Otimizada**.
