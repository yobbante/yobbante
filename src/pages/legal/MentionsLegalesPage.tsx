import { LegalLayout, Section, COMPANY_INFO } from '@/components/legal/LegalLayout';

export default function MentionsLegalesPage() {
  return (
    <LegalLayout
      title="Mentions légales"
      updatedAt="20 mai 2026"
      description="Mentions légales de la plateforme Yobbanté."
    >
      <Section title="1. Éditeur du site">
        <ul className="list-none space-y-1">
          <li><strong>Nom commercial :</strong> {COMPANY_INFO.name}</li>
          <li><strong>Forme juridique :</strong> {COMPANY_INFO.legalForm}</li>
          <li><strong>Siège social :</strong> {COMPANY_INFO.address}</li>
          <li><strong>NINEA :</strong> {COMPANY_INFO.ninea}</li>
          <li><strong>RCCM :</strong> {COMPANY_INFO.rccm}</li>
          <li><strong>Email :</strong> <a href={`mailto:${COMPANY_INFO.email}`} className="underline">{COMPANY_INFO.email}</a></li>
          <li><strong>Téléphone :</strong> {COMPANY_INFO.phone}</li>
          <li><strong>Site web :</strong> <a href={COMPANY_INFO.site} className="underline">{COMPANY_INFO.site}</a></li>
        </ul>
      </Section>

      <Section title="2. Directeur de la publication">
        <p>Le directeur de la publication est le représentant légal de {COMPANY_INFO.legalForm}.</p>
      </Section>

      <Section title="3. Hébergeur">
        <p>
          Le site est hébergé par {COMPANY_INFO.host}. Pour toute requête relative à l'hébergement,
          vous pouvez nous contacter à <a href={`mailto:${COMPANY_INFO.email}`} className="underline">{COMPANY_INFO.email}</a>.
        </p>
      </Section>

      <Section title="4. Propriété intellectuelle">
        <p>
          L'ensemble des éléments composant la plateforme Yobbanté (textes, graphismes, logos, icônes,
          images, photographies, code source, base de données, marque « Yobbanté » et « Dëkk ») sont
          la propriété exclusive de {COMPANY_INFO.legalForm} ou font l'objet d'une autorisation
          d'utilisation. Toute reproduction, représentation, modification, publication, transmission ou
          adaptation, totale ou partielle, est interdite sans accord écrit préalable.
        </p>
      </Section>

      <Section title="5. Limitation de responsabilité">
        <p>
          Yobbanté met tout en œuvre pour fournir des informations exactes et à jour. Toutefois,
          Yobbanté ne saurait être tenue responsable des erreurs ou omissions, ni des conséquences
          de l'utilisation des informations diffusées sur la plateforme.
        </p>
        <p>
          L'utilisateur reconnaît utiliser la plateforme sous sa seule responsabilité. Yobbanté ne
          peut être tenue responsable des dommages directs ou indirects résultant d'une interruption
          de service, d'une indisponibilité technique, ou de l'introduction d'un virus.
        </p>
      </Section>

      <Section title="6. Liens hypertextes">
        <p>
          La plateforme peut contenir des liens vers des sites tiers. Yobbanté n'exerce aucun contrôle
          sur ces sites et décline toute responsabilité quant à leur contenu.
        </p>
      </Section>

      <Section title="7. Droit applicable et juridiction">
        <p>
          Les présentes mentions légales sont régies par le droit sénégalais. En cas de litige, et à
          défaut de résolution amiable, les juridictions compétentes seront celles du ressort de la
          Cour d'appel de Dakar.
        </p>
      </Section>
    </LegalLayout>
  );
}
