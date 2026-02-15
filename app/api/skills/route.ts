import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const cwd = process.cwd();
    console.log('API Skills CWD:', cwd);
    
    // Try both with and without 'smbos' prefix depending on where we are running
    let skillsDir = path.join(cwd, 'skills');
    if (!fs.existsSync(skillsDir)) {
        skillsDir = path.join(cwd, 'smbos', 'skills');
    }
    
    console.log('API Skills Dir:', skillsDir);
    
    if (!fs.existsSync(skillsDir)) {
      return NextResponse.json([]);
    }

    const skills = fs.readdirSync(skillsDir).filter(f => {
        const fullPath = path.join(skillsDir, f);
        return fs.statSync(fullPath).isDirectory() && 
               (fs.existsSync(path.join(fullPath, 'ui.json')) || fs.existsSync(path.join(fullPath, 'SKILL.md')));
    }).map(id => {
        const skillPath = path.join(skillsDir, id);
        const uiJsonPath = path.join(skillPath, 'ui.json');
        
        let config: any = {};
        if (fs.existsSync(uiJsonPath)) {
            config = JSON.parse(fs.readFileSync(uiJsonPath, 'utf8'));
        } else {
            // Fallback to SKILL.md parsing or directory name
            config.name = id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        
        return {
            id,
            name: config.name || id,
            icon: config.icon || 'Skill'
        };
    });

    return NextResponse.json(skills);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
