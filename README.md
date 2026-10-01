# Estudo ADS — UNIVALI

Central de estudos do curso de Tecnologia em Análise e Desenvolvimento de Sistemas
da UNIVALI: resumos, flashcards, quizzes, simulados, questões discursivas e colas
de todas as matérias, em um único site que funciona offline.

**Site publicado:** https://samuelgomezdev.github.io/estudo-ads/

## O que tem dentro

| | |
|---|---|
| Matérias | 15 |
| Questões de múltipla escolha | 604 |
| Flashcards | 506 |
| Resumos | 69 |
| Colas / mapas mentais | 87 |

## Como funciona

O site não é escrito à mão — ele é **gerado** a partir da pasta do curso.

```
Univali/
├── Arquitetura de Computadores/     ← as pastas de cada matéria, com os PDFs
├── Paradigmas de Programação/
├── ...
└── Estudo-ADS/                      ← este repositório
    ├── gerar.py                     ← lê as pastas acima e monta o site
    ├── materias.json                ← cadastro: nome, período, cor e sigla
    ├── bancos/<id>.json             ← resumos, flashcards e questões de cada matéria
    ├── bancos/labs/<id>.lab         ← exercícios do Laboratório (texto puro)
    ├── labs.py                      ← leitor dos arquivos .lab
    ├── template/                    ← base.html, app.css, app.js
    ├── template/lab/                ← o Laboratório (motores, editor, trilha, tipos)
    ├── docs/index.html              ← versão publicada (GitHub Pages)
    └── index.html                   ← versão local, com link para os PDFs (não versionada)
```

**Criou uma pasta de matéria nova?** Basta rodar `python gerar.py`. Ela entra
sozinha no site. Renomeou uma pasta? O gerador reconhece e migra o cadastro,
sem duplicar o card.

```bash
python gerar.py                 # varre as pastas e regenera tudo
python gerar.py --sem-varredura # regenera usando o cadastro e o cache atuais
```

Depois é só `git add -A && git commit -m "atualiza site" && git push`.

## Scripts de qualidade

Em `_build/`:

- `extract.py` — importa os bancos dos sites de estudo antigos para o formato único
- `redistribui_gabarito.py` — equilibra a posição da alternativa correta
  (`--conferir` só mede, sem escrever)

## Formato do banco de questões

```json
{
  "id": "paradigmas",
  "nome": "Paradigmas de Programação",
  "periodo": 4,
  "sigla": "PP",
  "cor": "#a855f7",
  "resumos":     [{ "tema": "...", "html": "<p>...</p>" }],
  "flashcards":  [{ "tema": "...", "p": "pergunta", "r": "resposta" }],
  "questoes":    [{ "tema": "...", "q": "enunciado",
                    "op": ["A", "B", "C", "D"], "r": 2, "exp": "por quê" }],
  "discursivas": [{ "tema": "...", "q": "...", "r": "..." }],
  "colas":       [{ "titulo": "...", "mnemonico": "...", "pontos": ["..."] }],
  "links":       [{ "nome": "...", "url": "...", "desc": "..." }]
}
```

`r` é o índice da alternativa correta, começando em zero.

## Laboratório (aprender fazendo)

Aba de cada matéria em que o código **roda de verdade no navegador**: JavaScript,
Python (Pyodide), Prolog (Tau Prolog), SQL (SQLite via sql.js) e HTML/CSS com
preview ao vivo. Cada linguagem roda isolada (Web Worker ou iframe), com
tempo-limite contra laço infinito. As bibliotecas vêm de CDN na primeira vez.

Cinco tipos de exercício: **explorar** (rodar, alterar, observar), **prever**
(hipótese antes de rodar), **desafio** (testes automáticos, dicas, solução),
**montar** (Parsons: blocos embaralhados com armadilhas) e **passo a passo**
(execução linha por linha com pilha e variáveis, só JavaScript). Há trilha por
tema, XP, nível, sequência de dias e revisão espaçada dos exercícios de prever,
desafio e montar. O progresso fica no navegador (localStorage).

Os exercícios ficam em `bancos/labs/<id-da-matéria>.lab`, com o código escrito
normalmente:

```
=== banco loja                 ← script SQL reutilizável pelos labs SQL
CREATE TABLE ...;

=== lab id-unico
tipo: prever                   ← explorar | prever | desafio | parsons | passo
tema: Paradigma Imperativo     ← o mesmo nome de tema dos resumos
nivel: 1                       ← 1 a 3
linguagem: js                  ← js | python | prolog | sql | web | texto | java
titulo: Soma com estado mutável

--- enunciado
Texto com **negrito** e `código`.
--- codigo
console.log(1 + 1);
--- opcoes
- 2
- 11
--- explicacao
Por que isso acontece.
```

Outras seções: `solucao`, `testes`, `regras`, `dicas`, `experimentos`,
`consultas` (Prolog), `linhas`/`distratores` (montar), `pergunta`. Cabeçalhos
opcionais: `banco`, `alvo`, `ordem`, `verificar`, `resposta`, `erro`. O
formato completo está documentado no topo de `labs.py`, e o gerador avisa de
erros de autoria.

**Conferir o conteúdo:** abra `#/m/<id>/lab/autoteste` no site. Ele roda cada
exercício nos motores reais e aponta previsões com resposta ambígua, soluções
que não passam nos testes e desafios cujo código inicial já passa.

## Login do admin (histórico em até 5 máquinas)

Visitantes usam o site sem conta — o progresso fica no navegador de cada um.
O administrador entra pelo botão **Entrar** no topo e o histórico (quiz,
laboratório com XP e revisões, rascunhos das discursivas) passa a ser guardado
no **Supabase** e mesclado entre as máquinas: de cada lado fica sempre o
registro mais avançado, então nada se perde ao usar duas máquinas.

- No máximo **5 máquinas** por conta. A regra fica **no banco** (funções em
  `supabase/schema.sql`), não no navegador. Pelo painel da conta dá para ver as
  máquinas e desconectar uma para liberar a vaga.
- **Sair** mantém o progresso no navegador. **Sair e desconectar esta máquina**
  apaga o histórico local e libera a vaga (para computadores emprestados).

**Configurar (uma vez):**

1. Crie um projeto gratuito em supabase.com.
2. *SQL Editor → New query*: cole `supabase/schema.sql` inteiro e clique em *Run*.
3. *Authentication → Sign In / Providers → Email*: desligue **Allow new users to sign up**
   (só o admin tem conta).
4. *Authentication → Users → Add user → Create new user*: seu e-mail e uma senha
   forte, com **Auto Confirm User** marcado.
5. *Project Settings → API Keys*: copie a **Project URL** e a chave **anon / publishable**
   para o `conta.json`:

```json
{ "url": "https://SEU-PROJETO.supabase.co", "chave": "a chave anon ou publishable" }
```

6. Rode o `atualizar.bat`.

A chave anon é **pública por natureza** (vai para o navegador de qualquer
visitante); quem protege os dados são as regras do banco. **Nunca** use a chave
`service_role`/secreta — o `gerar.py` recusa essa chave e desliga o login.

## Segurança

- **Dados de outros nunca viram HTML:** tudo que vem de usuário, dos motores do
  laboratório (Workers e iframes rodam código do aluno) ou do banco entra na
  página como texto. Resultados dos Workers são validados por formato antes de
  usar (`L.limparRastro`), e o HTML dos resumos passa por uma lista de tags
  permitidas (`sanitizarHtml` no `app.js`).
- **Código do aluno isolado:** JS, Python, Prolog e SQL rodam em Web Workers
  (sem acesso à página nem ao login); HTML/CSS roda em iframe `sandbox` sem
  `allow-same-origin`.
- **CSP** (gerada no `gerar.py`): scripts só do próprio site e dos dois CDNs;
  envio de dados (fetch/XHR) só para o próprio site, o Supabase do projeto e os
  CDNs; imagens só locais. Precisa de `'unsafe-inline'`/`'unsafe-eval'` por causa
  dos exercícios — por isso é camada extra, não a defesa principal.
- **SRI:** todo arquivo de CDN que roda na página principal tem hash em `L.SRI`
  (`template/lab/00-base.js`); sem hash cadastrado ele não carrega. Ao trocar
  de versão: `curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A`.
- **Supabase:** tabelas sem acesso direto; só funções que filtram por
  `auth.uid()`, validam a entrada e garantem o limite de máquinas. Depois de
  mudar `supabase/schema.sql`, rode o arquivo de novo no SQL Editor.

## Observação

Os PDFs e materiais de aula **não** fazem parte deste repositório — são material
das disciplinas e ficam apenas na máquina local. A versão publicada lista os
nomes dos arquivos, sem os arquivos em si.
