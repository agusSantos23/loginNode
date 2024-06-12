import express from 'express'
import bodyParser from 'body-parser';

import { createClient } from "@libsql/client";
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config()

export const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});


await turso.execute(`
    CREATE TABLE IF NOT EXISTS users( 
    id PRIMARY KEY, 
    name VARCHAR NOT NULL,
    pass VARCHAR NOT NULL,
    email VARCHAR NOT NULL
)`)



const app = express();

const port = process.env.PORT ?? 3000

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.get('/',(req,res)=>{

    res.sendFile(process.cwd() + "/client/index.html")
})

app.post('/',async(req, res)=>{

    const {username, password} = req.body

    try {

        const response = await turso.execute({
            sql: "SELECT * FROM users WHERE name = ?",
            args: [username]
        })
        const {userId, userName, userPass, userEmail} = response

        console.log(userId, userName, userPass, userEmail)
        
    } catch (error) {
        console.log(error);
    }

    

    if(username === 'agus' && password === "1234"){

        res.json({success: true, message: "Login fue exitoso"})

    }else{
        res.json({success: false, message: "Login fue un fracaso"})
        
    }
})

app.get('/crear',(req,res)=>{

    res.sendFile(process.cwd() + "/client/crearUser.html")
})

app.post('/crear', async (req,res)=>{
    const {username, password, email} = req.body

    const newUserId = uuidv4()
    try{
        const response = await turso.execute({
            sql:"INSERT INTO users (id,name,pass,email)VALUES(?,?,?,?)",
            args:[newUserId,username,password,email]
        })

        if(response){
            res.json({success: true, message: "Se ha creado su cuenta correctamente"})
        }else{
            res.json({success: true, message: "No se pudo crear su usuario"})
        }
    }catch(e){
        console.log(e)
        res.status(500).json({ success: false, message: "Ocurrió un error en el servidor" });
    }

})


app.listen(port, ()=>{

    console.log(`El servidor se levanto en el puerto ${port}`)
})
