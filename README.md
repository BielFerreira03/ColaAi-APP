# 🚌 Cola ai - Aplicativo de Transporte Escolar

**Cola Ai** é uma aplicação voltada para conectar responsáveis, motoristas e alunos.

---

## 🚀 Tecnologias Utilizadas

- **React**
- **Firebase (Authentication, Firestore, etc.)**
- **JavaScript / Node.js**

---

## ⚙️ Pré-requisitos
- [Node.js](https://nodejs.org/) (versão recomendada: LTS)
- [npm](https://npmjs.com/)

---

## 📦 Instalação

Clone o repositório e instale as dependências:

```bash
cd nome-do-repositorio
npm install
```

⚠️ O projeto depende da integração com o Firebase. Este arquivo está no .gitignore por motivos de segurança, então cada colaborador precisa criá-lo localmente.


```JavaScript
import { initializeApp } from "firebase/app";

// CONFIG AQUI

const app = initializeApp(firebaseConfig);

export default app;

```