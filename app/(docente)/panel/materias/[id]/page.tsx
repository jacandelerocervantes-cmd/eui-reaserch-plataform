"use client";
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Megaphone, MoreVertical, Clock, MessageSquare } from 'lucide-react';
import styles from './tablon.module.css';

export default function TablonPage() {
  const { id } = useParams();
  
  // Simulamos los anuncios que insertaría la IA o el docente
  const [anuncios] = useState([
    {
      id: 1,
      titulo: "¡Bienvenidos al nuevo semestre!",
      contenido: "Recuerden que el syllabus ya está disponible en la sección de Drive. Por favor, revísenlo antes de la próxima clase.",
      fecha: "Hace 2 horas",
      autor: "Prof. Cervantes"
    },
    {
      id: 2,
      titulo: "Material de Lectura Obligatorio",
      contenido: "He subido un nuevo PDF sobre Redes Neuronales. Es vital para la actividad de esta semana.",
      fecha: "Ayer",
      autor: "Prof. Cervantes"
    }
  ]);

  return (
    <div className={styles.container}>
      {/* Banner de la Materia */}
      <div className={styles.heroBanner}>
        <div className={styles.bannerContent}>
          <h1>Ingeniería de Software II</h1>
          <p>Clave: {id} | Grupo: 6A</p>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* Columna Izquierda: Próximos Eventos */}
        <aside className={styles.sidebar}>
          <div className={styles.widget}>
            <h3>Próximas Entregas</h3>
            <ul className={styles.taskList}>
              <li>
                <Clock size={14} />
                <span>Práctica 1 - Viernes 23:59</span>
              </li>
              <li>
                <Clock size={14} />
                <span>Examen Unidad 1 - Lunes</span>
              </li>
            </ul>
          </div>
        </aside>

        {/* Columna Central: Feed de Anuncios */}
        <main className={styles.feed}>
          <div className={styles.composeBox}>
            <div className={styles.avatar}>P</div>
            <button className={styles.composeBtn}>Anunciar algo a la clase...</button>
          </div>

          {anuncios.map((anuncio) => (
            <article key={anuncio.id} className={styles.postCard}>
              <div className={styles.postHeader}>
                <div className={styles.postMeta}>
                  <div className={styles.avatarSmall}>P</div>
                  <div>
                    <span className={styles.author}>{anuncio.autor}</span>
                    <span className={styles.date}>{anuncio.fecha}</span>
                  </div>
                </div>
                <button className={styles.menuBtn}><MoreVertical size={18} /></button>
              </div>
              <div className={styles.postBody}>
                <h4>{anuncio.titulo}</h4>
                <p>{anuncio.contenido}</p>
              </div>
              <div className={styles.postFooter}>
                <button className={styles.actionBtn}>
                  <MessageSquare size={16} /> Comentarios de clase
                </button>
              </div>
            </article>
          ))}
        </main>
      </div>
    </div>
  );
}