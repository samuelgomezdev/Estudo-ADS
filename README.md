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
    ├── template/                    ← base.html, app.css, app.js
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

## Observação

Os PDFs e materiais de aula **não** fazem parte deste repositório — são material
das disciplinas e ficam apenas na máquina local. A versão publicada lista os
nomes dos arquivos, sem os arquivos em si.
