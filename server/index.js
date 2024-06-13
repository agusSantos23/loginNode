import express from 'express'
import bodyParser from 'body-parser'
import bcrypt from 'bcrypt'

import { SALT_ROUNDS } from './config.js'
import { createClient } from "@libsql/client"
import dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'


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

        const user = response.rows[0]
            
        if(user){
            const resultHash = await bcrypt.compare(password, user.pass)
            if(resultHash){
                return res.json({success: true, message: "Has iniciado sesion correctamente"})
            }
        }

        return res.json({success: false, message: "No se a encontrado ningun usuario"})

        
        
    } catch (error) {

        console.log(error);
        return res.status(500).json({ success: false, message: "Ocurrió un error en el servidor" });

    }

})

app.get('/crear',(req,res)=>{

    res.sendFile(process.cwd() + "/client/crearUser.html")
})

app.post('/crear', async (req,res)=>{
    const {username, password, email} = req.body

    const newUserId = uuidv4()
    try{
        //Comprobacion si existe nombre o correo en la bd
        const responseExists = await turso.execute({
            sql:"SELECT name,email FROM users WHERE name = ? OR email = ?",
            args: [username, email]
        })

        const user = responseExists.rows[0]
        //Si no existe registra el usuario
        if(user){
            return res.json({success: false, message: "Ya existe un usuario con ese nombre o direcion de correo"})
        } 

        const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS)

        const responseNew = await turso.execute({
            sql:"INSERT INTO users (id,name,pass,email)VALUES(?,?,?,?)",
            args:[newUserId,username,passwordHash,email]
        })

        if(responseNew){
            return res.json({success: true, message: "Se ha creado su cuenta correctamente"})
        }else{
            return res.json({success: true, message: "No se pudo crear su usuario"})
        }
        
    }catch(e){

        console.log(e)
        return res.status(500).json({ success: false, message: "Ocurrió un error en el servidor" });
    }

})


app.listen(port,()=>{

    console.log(`El servidor se levanto en el puerto http://localhost:${port}`)
})
