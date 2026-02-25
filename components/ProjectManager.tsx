'use client';

import { useState } from 'react';
import { TextInput, Button, InlineLoading } from '@carbon/react';

interface ProjectManagerProps {
  mode: 'create' | 'edit'; // Extend later
  onProjectCreated?: () => void;
  onNavigate: (page: string) => void;
}

export function ProjectManager({ mode, onProjectCreated, onNavigate }: ProjectManagerProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      // 1. Fetch current projects
      const res = await fetch('/api/projects');
      const data = await res.json();
      const projects = data.projects || [];
      
      // 2. Add new project
      const newProject = {
        id: crypto.randomUUID(),
        name: name,
        agentIds: []
      };
      
      const updatedProjects = [...projects, newProject];
      
      // 3. Save
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: updatedProjects })
      });
      
      if (onProjectCreated) onProjectCreated();
      onNavigate('dashboard'); // Optionally navigate to the new project
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'create') {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px' }}>
        <h3>Create New Project</h3>
        <div style={{ marginTop: '1rem' }}>
          <TextInput 
            id="project-name" 
            labelText="Project Name" 
            value={name} 
            onChange={(e: any) => setName(e.target.value)} 
            placeholder="My New Project"
          />
        </div>
        <div style={{ marginTop: '2rem' }}>
          {loading ? <InlineLoading description="Creating..." /> : (
            <Button onClick={handleCreate} disabled={!name}>Create Project</Button>
          )}
        </div>
      </div>
    );
  }

  return <div>Edit mode not implemented</div>;
}
