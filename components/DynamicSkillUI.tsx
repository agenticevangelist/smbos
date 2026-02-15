'use client';

import { useState, useEffect } from 'react';
import {
  Grid,
  Column,
  TextInput,
  Button,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  Tag,
  Checkbox,
  Select,
  SelectItem,
  NumberInput,
  Accordion,
  AccordionItem,
  InlineNotification,
  Pagination,
  ProgressBar,
} from '@carbon/react';
import { Search, Filter, Download } from '@carbon/icons-react';

interface SkillUIConfig {
  id: string;
  name: string;
  description: string;
  inputs: Array<{
    id: string;
    label: string;
    type: string;
    placeholder?: string;
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    default?: any;
    helperText?: string;
  }>;
  api: {
    url: string;
    method: string;
    bodyMapping: Record<string, string>;
  };
  outputs: {
    type: 'table';
    rootPath: string;
    columns: Array<{
      key: string;
      header: string;
      type?: 'tag' | 'linkOrTag' | 'text';
      tagType?: 'rating' | 'status' | 'default';
    }>;
  };
  filters: Array<{
    id: string;
    label: string;
    type: 'checkbox' | 'select' | 'number';
    field?: string;
    options?: Array<{ value: string; text: string }>;
  }>;
}

interface DynamicSkillUIProps {
  skillId: string;
}

export function DynamicSkillUI({ skillId }: DynamicSkillUIProps) {
  const [config, setConfig] = useState<SkillUIConfig | null>(null);
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  // Filter states
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    // In a real app, fetch from /api/skills/[id]
    // For now, we'll try to load from the local ui.json if possible or mock it
    const loadConfig = async () => {
      try {
        const response = await fetch(`/api/skills/${skillId}`);
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
          
          // Initialize inputs with defaults
          const initialInputs: Record<string, any> = {};
          data.inputs.forEach((input: any) => {
            initialInputs[input.id] = input.default ?? '';
          });
          setInputs(initialInputs);
        } else {
            setError(`Failed to load skill configuration for ${skillId}`);
        }
      } catch (err) {
        setError('Error loading skill configuration');
      }
    };

    loadConfig();
  }, [skillId]);

  const handleInputChange = (id: string, value: any) => {
    setInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleFilterChange = (id: string, value: any) => {
    setFilterValues(prev => ({ ...prev, [id]: value }));
    setCurrentPage(1);
  };

  const handleExecute = async () => {
    if (!config) return;
    setIsProcessing(true);
    setError(null);
    setStatus('Executing skill...');

    try {
      // Map inputs to body
      const body: Record<string, any> = {};
      Object.entries(config.api.bodyMapping).forEach(([key, value]) => {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
          const inputId = value.slice(2, -2);
          body[key] = inputs[inputId];
        } else {
          body[key] = value;
        }
      });

      const response = await fetch(config.api.url, {
        method: config.api.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Execution failed');
      }

      const resultsData = config.outputs.rootPath ? data[config.outputs.rootPath] : data;
      setResults(resultsData || []);
      setStatus(`Success! Found ${resultsData?.length || 0} items.`);
      
      // Track usage (SMBOS Feature)
      trackUsage(skillId, inputs, resultsData?.length || 0);

      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('');
    } finally {
      setIsProcessing(false);
    }
  };

  const trackUsage = async (skillId: string, params: any, resultCount: number) => {
    try {
      await fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          params,
          resultCount,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('Failed to track usage', e);
    }
  };

  const getFilteredResults = () => {
    if (!config || results.length === 0) return [];
    
    return results.filter(item => {
      for (const filter of config.filters) {
        const val = filterValues[filter.id];
        if (val === undefined || val === null || val === 'all' || val === false) continue;
        
        const itemVal = item[filter.field || filter.id];
        
        if (filter.type === 'checkbox' && !itemVal) return false;
        if (filter.type === 'select') {
            // Specialized logic for ratings if needed, or generic
            if (filter.id === 'ratingCondition') {
                if (val === 'good' && itemVal < 4.0) return false;
                if (val === 'bad' && itemVal >= 4.0) return false;
            } else if (itemVal != val) {
                return false;
            }
        }
      }
      return true;
    });
  };

  if (!config) {
    return <div>Loading skill {skillId}...</div>;
  }

  const filteredResults = getFilteredResults();
  const paginatedResults = filteredResults.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderCell = (row: any, col: any) => {
    const value = row[col.key];
    if (col.type === 'tag') {
        if (col.tagType === 'rating') {
            return (
                <Tag type={value >= 4 ? 'green' : value >= 3 ? 'gray' : 'red'}>
                    {Number(value).toFixed(1)} ★
                </Tag>
            );
        }
        return <Tag>{value}</Tag>;
    }
    if (col.type === 'linkOrTag') {
        if (row.hasInstagram) return <Tag type="blue">Instagram</Tag>;
        if (value) return <a href={value} target="_blank" rel="noopener noreferrer">Visit</a>;
        return <Tag type="gray">None</Tag>;
    }
    return value;
  };

  return (
    <div className="dynamic-skill-ui">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="page-title">{config.name}</h1>
          <p className="page-description">{config.description}</p>
        </Column>

        <Column lg={16} md={8} sm={4} className="search-section" style={{ marginBottom: '2rem' }}>
          <Grid condensed>
            {config.inputs.map(input => (
              <Column key={input.id} lg={input.type === 'number' ? 3 : 6} md={4} sm={4}>
                {input.type === 'text' && (
                  <TextInput
                    id={input.id}
                    labelText={input.label}
                    placeholder={input.placeholder}
                    value={inputs[input.id] || ''}
                    onChange={(e) => handleInputChange(input.id, e.target.value)}
                  />
                )}
                {input.type === 'number' && (
                  <NumberInput
                    id={input.id}
                    label={input.label}
                    min={input.min}
                    max={input.max}
                    step={input.step}
                    value={inputs[input.id] || 0}
                    onChange={(_, { value }) => handleInputChange(input.id, value)}
                    helperText={input.helperText}
                  />
                )}
              </Column>
            ))}
            <Column lg={3} md={4} sm={4} className="search-button-col" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button
                onClick={handleExecute}
                renderIcon={Search}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Execute'}
              </Button>
            </Column>
          </Grid>
        </Column>

        {status && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="info"
              title="Status"
              subtitle={status}
              hideCloseButton
              lowContrast
            />
          </Column>
        )}

        {error && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={error}
              onClose={() => setError(null)}
              lowContrast
            />
          </Column>
        )}

        {results.length > 0 && (
          <>
            <Column lg={16} md={8} sm={4} className="filters-section" style={{ marginBottom: '1rem' }}>
              <Accordion>
                <AccordionItem title={`Smart Filters (${filteredResults.length} results)`}>
                  <Grid condensed>
                    {config.filters.map(filter => (
                      <Column key={filter.id} lg={4} md={4} sm={4}>
                        {filter.type === 'checkbox' && (
                          <Checkbox
                            id={filter.id}
                            labelText={filter.label}
                            checked={!!filterValues[filter.id]}
                            onChange={(e) => handleFilterChange(filter.id, e.target.checked)}
                          />
                        )}
                        {filter.type === 'select' && (
                          <Select
                            id={filter.id}
                            labelText={filter.label}
                            value={filterValues[filter.id] || 'all'}
                            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                          >
                            {filter.options?.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} text={opt.text} />
                            ))}
                          </Select>
                        )}
                      </Column>
                    ))}
                  </Grid>
                </AccordionItem>
              </Accordion>
            </Column>

            <Column lg={16} md={8} sm={4}>
              <DataTable rows={paginatedResults.map(r => ({ ...r, id: r.id || r.name }))} headers={config.outputs.columns}>
                {({
                  rows,
                  headers,
                  getTableProps,
                  getHeaderProps,
                  getRowProps,
                  getTableContainerProps,
                }) => (
                  <TableContainer
                    title="Results"
                    description={`Found ${filteredResults.length} items matching your criteria`}
                    {...getTableContainerProps()}
                  >
                    <Table {...getTableProps()}>
                      <TableHead>
                        <TableRow>
                          {headers.map((header) => {
                            const { key, ...headerProps } = getHeaderProps({ header });
                            return (
                              <TableHeader key={key} {...headerProps}>
                                {header.header}
                              </TableHeader>
                            );
                          })}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row, i) => {
                          const { key, ...rowProps } = getRowProps({ row });
                          return (
                            <TableRow key={key} {...rowProps}>
                              {row.cells.map((cell, j) => (
                                <TableCell key={cell.id}>
                                  {renderCell(paginatedResults[i], config.outputs.columns[j])}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DataTable>
            </Column>

            <Column lg={16} md={8} sm={4}>
              <Pagination
                backwardText="Previous"
                forwardText="Next"
                itemsPerPageText="Items per page:"
                page={currentPage}
                pageSize={pageSize}
                pageSizes={[10, 20, 50]}
                totalItems={filteredResults.length}
                onChange={({ page, pageSize }) => {
                  setCurrentPage(page);
                  setPageSize(pageSize);
                }}
              />
            </Column>
          </>
        )}
      </Grid>
    </div>
  );
}
