import { NextResponse } from 'next/server';
import { getAllSkills } from '@/lib/skills/registry';

export async function GET() {
  try {
    const skills = await getAllSkills();

    return NextResponse.json(skills.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      icon: s.icon,
      hidden: s.hidden,
    })));
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
