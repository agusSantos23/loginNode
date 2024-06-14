import express from 'express'
import bodyParser from 'body-parser'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'

import { createClient } from "@libsql/client"
import dotenv from 'dotenv'
import { SALT_ROUNDS, SECRET_KEY } from './config.js'
import { v4 as uuidv4 } from 'uuid'

dotenv.config()


const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});


turso.execute(`
    CREATE TABLE IF NOT EXISTS users( 
    id PRIMARY KEY, 
    name VARCHAR NOT NULL,
    pass VARCHAR NOT NULL,
    email VARCHAR NOT NULL
)`)


const app = express();

app.set('view engine','ejs')

const port = process.env.PORT ?? 3000

app.use(bodyParser.json())
app.use(cookieParser())

app.use((req,res,next)=>{
    const token = req.cookies.access_token
    
    if(!token){
        return res.status(403).redirect('/')
    }

    try{

        const data = jwt.verify(token, SECRET_KEY)
        req.session =  req.session ||{}
        req.session.user = data

    }catch (error) {
        return res.status(401).redirect('/')
    }
    next()
})

app.get('/',(req,res)=>{

    return res.render('login')
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

                const token = jwt.sign(
                    {id: user.id, username: user.name},
                    SECRET_KEY,
                    {
                    expiresIn:'1h'
                    }
                )

                return res
                        .cookie('access_token', token,{
                            httpOnly: true, //La cookie solo se puede adceder desde el servidor
                            secure: process.env.NODE_ENV == 'production', //La cookie solo puede ser acceder en https
                            sameSite: 'strict', //solo puede adceder al dominio en el que se encuentra
                            maxAge: 1000 * 30 * 30 //tiempo de vida
                        })
                        .json({success: true, message: "Redireccion"})
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

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

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

        return res.status(500).json({ success: false, message: "Ocurrió un error en el servidor" });
    }

})
app.get('/home',async (req, res) => {
    try {
        const {user} = req.session
        if(!user) return res.status(401).redirect('/')
       
        console.log(user)
        res.render('home', user)

    } catch (error) {
        console.error('Error verificando token:', error)
        return res.status(401).redirect('/')
    }
});



app.listen(port,()=>{

    console.log(`El servidor se levanto en el puerto http://localhost:${port}`)
})
